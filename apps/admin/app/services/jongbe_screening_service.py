"""
종가 베팅(종베) 검색식 서비스

FinanceDataReader를 사용하여 당일 종가매수 후보를 스크리닝합니다.
평일 15:00 KST 1회 실행 (동시호가 15:20 전 결과 확보).
ThreadPoolExecutor 병렬처리로 3~5분 내 완료.

스크리닝 조건 (8개 전량 충족):
  A: 시가총액 500억 이상
  B: 거래대금 순위 상위 100위 이내
  C: 등락률 5% ~ 20%
  D: 양봉 (종가 > 시가)
  E: 고가 대비 -3% 이내 (윗꼬리 짧음)
  F: 종가 > 5일 이동평균선
  G: RSI(14) 50 이상 80 이하
  H: 전일 대비 거래량 200% 이상
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pytz

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.engine.models import JongbeScreeningResult
from app.services.screening_progress import update_progress, reset_progress

KST = pytz.timezone("Asia/Seoul")
MAX_WORKERS = 8


def _rsi(close, period=14):
    """RSI(14) 직접 계산 (pandas Series)"""
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def _fetch_ohlcv(symbol: str) -> Optional[Tuple[str, object]]:
    """개별 종목 OHLCV 조회 (ThreadPoolExecutor에서 호출)"""
    import FinanceDataReader as fdr

    try:
        df = fdr.DataReader(symbol)
        if df is not None and len(df) >= 20:
            return (symbol, df)
    except Exception:
        pass
    return None


def _analyze_stock_jongbe(
    symbol: str,
    name: str,
    df,
    trading_value_rank: int,
    market_cap_억: float,
) -> Optional[Dict]:
    """
    개별 종목 조건 판정 (조건 C~H).
    조건 A(시총), B(거래대금순위)는 사전 필터로 이미 통과.
    """
    if len(df) < 20:
        return None

    df = df.reset_index(drop=True)
    curr = df.iloc[-1]

    matched = ["A", "B"]  # 사전 필터 통과

    # [조건 C] 등락률 5% ~ 20%
    if len(df) >= 2:
        prev_close = df.iloc[-2]["Close"]
        if prev_close > 0:
            change_pct = (curr["Close"] - prev_close) / prev_close * 100
        else:
            change_pct = 0
    else:
        change_pct = 0

    if 5 <= change_pct <= 20:
        matched.append("C")

    # [조건 D] 양봉 (종가 > 시가)
    if curr["Close"] > curr["Open"]:
        matched.append("D")

    # [조건 E] 고가 대비 -3% 이내
    if curr["High"] > 0:
        high_ratio = curr["Close"] / curr["High"]
        if high_ratio >= 0.97:
            matched.append("E")
    else:
        high_ratio = 0

    # [조건 F] 종가 > 5일 이동평균선
    ma5 = df["Close"].rolling(window=5).mean()
    ma5_val = ma5.iloc[-1]
    if not (ma5_val != ma5_val) and curr["Close"] > ma5_val:  # NaN check
        matched.append("F")

    # [조건 G] RSI(14) 50 이상 80 이하
    rsi_series = _rsi(df["Close"], 14)
    rsi_val = rsi_series.iloc[-1]
    if not (rsi_val != rsi_val) and 50 <= rsi_val <= 80:  # NaN check
        matched.append("G")

    # [조건 H] 전일 대비 거래량 200% 이상
    if len(df) >= 2:
        prev_volume = df.iloc[-2]["Volume"]
        curr_volume = curr["Volume"]
        if prev_volume > 0:
            volume_ratio = curr_volume / prev_volume
            if volume_ratio >= 2.0:
                matched.append("H")
        else:
            volume_ratio = 0
    else:
        volume_ratio = 0

    # 모든 조건 충족 확인 (A~H)
    required = {"A", "B", "C", "D", "E", "F", "G", "H"}
    if not required.issubset(set(matched)):
        return None

    # 거래대금 계산 (억원)
    trading_value = curr["Close"] * curr["Volume"] / 1_0000_0000  # 억원

    return {
        "stock_code": symbol,
        "stock_name": name,
        "current_price": str(int(curr["Close"])),
        "change_percent": f"{change_pct:+.2f}%",
        "volume": str(int(curr["Volume"])) if "Volume" in curr.index else "",
        "trading_value": f"{trading_value:,.0f}",
        "trading_value_rank": trading_value_rank,
        "market_cap": f"{market_cap_억:,.0f}",
        "high_ratio": f"{high_ratio * 100:.1f}%",
        "ma5": str(int(ma5_val)) if not (ma5_val != ma5_val) else "",
        "rsi14": f"{rsi_val:.1f}" if not (rsi_val != rsi_val) else "",
        "volume_ratio": f"{volume_ratio * 100:.0f}%",
        "matched_conditions": ",".join(matched),
    }


def _scan_market_jongbe(market: str) -> List[Dict]:
    """
    종베 조건 스캔 (2-pass + 병렬처리):
    1) 시총 500억+ 필터
    2) 병렬로 OHLCV 조회 + 거래대금 계산
    3) 거래대금 상위 100위 필터
    4) 조건 C~H 판정
    """
    import FinanceDataReader as fdr

    listing_name = "KOSPI" if market == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception as e:
        print(f"[종베] {listing_name} 종목 리스트 조회 실패: {e}")
        return []

    # Code/Name 컬럼 찾기
    code_col = None
    for candidate in ["Code", "Symbol", "code", "symbol"]:
        if candidate in listing.columns:
            code_col = candidate
            break
    name_col = None
    for candidate in ["Name", "name", "종목명"]:
        if candidate in listing.columns:
            name_col = candidate
            break

    if not code_col or not name_col:
        print(f"[종베] {listing_name} 컬럼을 찾을 수 없습니다: {listing.columns.tolist()}")
        return []

    # [조건 A] 시총 500억 이상 필터
    marcap_col = None
    for candidate in ["Marcap", "MarketCap", "marcap", "marketcap"]:
        if candidate in listing.columns:
            marcap_col = candidate
            break
    if not marcap_col:
        print(f"[종베] 경고: {listing_name} 시총 컬럼 없음 - 시총 필터 불가. 컬럼: {listing.columns.tolist()}")
        return []

    # 시총 단위: 원 → 억원 변환
    listing = listing[listing[marcap_col] >= 500 * 1_0000_0000].copy()
    listing["market_cap_억"] = listing[marcap_col] / 1_0000_0000

    # 유효 종목코드 필터
    symbols_info = []
    for _, row in listing.iterrows():
        symbol = str(row[code_col]).strip()
        name = str(row[name_col]).strip()
        market_cap_억 = row["market_cap_억"]
        if symbol and len(symbol) == 6:
            symbols_info.append((symbol, name, market_cap_억))

    total = len(symbols_info)
    print(f"[종베] {market.upper()} 시총 500억+ 종목: {total}개 → 병렬 OHLCV 조회 시작")
    update_progress("jongbe", phase=f"OHLCV 조회 ({market.upper()})", current=0, total=total,
                    message=f"{market.upper()} {total}개 종목 OHLCV 조회 시작")

    # 1st pass: 병렬로 OHLCV 조회
    ohlcv_data = {}  # symbol -> df
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(_fetch_ohlcv, sym): (sym, name, mcap)
            for sym, name, mcap in symbols_info
        }
        done_count = 0
        for future in futures:
            result = future.result()
            done_count += 1
            if result:
                sym, df = result
                ohlcv_data[sym] = df
            if done_count % 50 == 0 or done_count == total:
                update_progress("jongbe", phase=f"OHLCV 조회 ({market.upper()})",
                                current=done_count, total=total,
                                message=f"{market.upper()} OHLCV 조회 {done_count}/{total}")
                if done_count % 100 == 0:
                    print(f"[종베] {market.upper()} OHLCV 조회 {done_count}/{total}...")

    print(f"[종베] {market.upper()} OHLCV 조회 완료: {len(ohlcv_data)}/{total}개 성공")
    update_progress("jongbe", phase=f"거래대금 순위 계산 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} 거래대금 순위 계산 중...")

    # 거래대금 계산 및 순위 부여
    trading_values = []
    for sym, name, mcap in symbols_info:
        if sym not in ohlcv_data:
            continue
        df = ohlcv_data[sym]
        curr = df.iloc[-1]
        tv = curr["Close"] * curr["Volume"]  # 거래대금 (원)
        trading_values.append((sym, name, mcap, tv, df))

    # 거래대금 내림차순 정렬 → 순위 부여
    trading_values.sort(key=lambda x: x[3], reverse=True)

    # [조건 B] 상위 100위 이내만 통과
    top_100 = trading_values[:100]

    # 2nd pass: 조건 C~H 판정
    results = []
    for rank_idx, (sym, name, mcap, tv, df) in enumerate(top_100, 1):
        try:
            result = _analyze_stock_jongbe(sym, name, df, rank_idx, mcap)
            if result:
                results.append(result)
        except Exception:
            pass

    print(f"[종베] {market.upper()} 스캔 완료: {total}종목 → 거래대금 TOP100 → {len(results)}건 조건 충족")
    update_progress("jongbe", phase=f"조건 판정 완료 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} {len(results)}건 조건 충족")
    return results


async def scan_all_stocks_jongbe() -> Dict[str, List[Dict]]:
    """코스피/코스닥 종베 스캔 (asyncio.to_thread)"""
    kospi_results = await asyncio.to_thread(_scan_market_jongbe, "kospi")
    kosdaq_results = await asyncio.to_thread(_scan_market_jongbe, "kosdaq")

    return {
        "kospi": kospi_results,
        "kosdaq": kosdaq_results,
    }


async def collect_and_save_jongbe(db: Session) -> Dict[str, int]:
    """
    종베 스크리닝 실행 후 DB에 저장.
    기존 결과를 삭제하고 최신 결과만 보관.
    """
    now_kst = datetime.now(KST)
    screening_date = now_kst.strftime("%Y-%m-%d")
    collected_at = now_kst.replace(second=0, microsecond=0)

    print(f"[종베] 스크리닝 시작 ({screening_date})")
    reset_progress("jongbe")

    all_results = await scan_all_stocks_jongbe()
    totals: Dict[str, int] = {}

    for market_type in ("kospi", "kosdaq"):
        items = all_results.get(market_type, [])

        # 기존 데이터 삭제
        db.query(JongbeScreeningResult).filter(
            JongbeScreeningResult.market_type == market_type,
        ).delete(synchronize_session=False)

        # 새 결과 저장 (순번 부여)
        for rank, item in enumerate(items, 1):
            row = JongbeScreeningResult(
                market_type=market_type,
                rank=rank,
                stock_code=item["stock_code"],
                stock_name=item["stock_name"],
                current_price=item["current_price"],
                change_percent=item["change_percent"],
                volume=item["volume"],
                trading_value=item["trading_value"],
                trading_value_rank=item["trading_value_rank"],
                market_cap=item["market_cap"],
                high_ratio=item["high_ratio"],
                ma5=item["ma5"],
                rsi14=item["rsi14"],
                volume_ratio=item["volume_ratio"],
                matched_conditions=item["matched_conditions"],
                screening_date=screening_date,
                collected_at=collected_at,
            )
            db.add(row)

        totals[market_type] = len(items)
        print(f"[종베] {market_type.upper()} → {len(items)}개 저장")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[종베] DB 저장 오류: {e}")
        update_progress("jongbe", status="error", phase="오류", message=f"DB 저장 오류: {e}")
        raise

    msg = f"완료: 코스피 {totals.get('kospi', 0)}건, 코스닥 {totals.get('kosdaq', 0)}건"
    print(f"[종베] 스크리닝 {msg}")
    update_progress("jongbe", status="completed", phase="완료", current=1, total=1, message=msg)
    return totals


def get_latest_jongbe_results(db: Session, market_type: str, limit: int = 50) -> Dict:
    """
    최신 종베 결과 조회.
    Returns: {"data": [...], "screening_date": "YYYY-MM-DD", "count": N}
    """
    latest_at = (
        db.query(func.max(JongbeScreeningResult.collected_at))
        .filter(JongbeScreeningResult.market_type == market_type)
        .scalar()
    )
    if not latest_at:
        return {"data": [], "screening_date": None, "count": 0}

    rows = (
        db.query(JongbeScreeningResult)
        .filter(
            JongbeScreeningResult.market_type == market_type,
            JongbeScreeningResult.collected_at == latest_at,
        )
        .order_by(JongbeScreeningResult.rank)
        .limit(limit)
        .all()
    )

    data = [
        {
            "rank": r.rank,
            "stock_code": r.stock_code,
            "stock_name": r.stock_name,
            "current_price": r.current_price,
            "change_percent": r.change_percent,
            "volume": r.volume,
            "trading_value": r.trading_value,
            "trading_value_rank": r.trading_value_rank,
            "market_cap": r.market_cap,
            "high_ratio": r.high_ratio,
            "ma5": r.ma5,
            "rsi14": r.rsi14,
            "volume_ratio": r.volume_ratio,
            "matched_conditions": r.matched_conditions,
            "screening_date": r.screening_date,
        }
        for r in rows
    ]
    screening_date = rows[0].screening_date if rows else None
    return {"data": data, "screening_date": screening_date, "count": len(data)}
