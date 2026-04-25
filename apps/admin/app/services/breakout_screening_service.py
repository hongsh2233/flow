"""
주도주 매물 소화 및 돌파 검색식 서비스 (급등 예상)

당일 주도 테마 1등주의 매물 소화 후 박스권 돌파 패턴을 스크리닝합니다.
현대에너지솔루션, SK이터닉스, LIG넥스원 등의 공통 패턴을 로직화.

스크리닝 조건 (5개 전량 충족):
  A: 거래대금 상위 (시총 500억+ & 거래대금 TOP 150) — 주도주 대상
  B: 저점 상승 (최근 3봉 Low 지속 상승) — 에너지 축적
  C: 박스 상단 2회+ 터치 (20봉 박스 상단 98% 이내) — 매물 소화
  D: 박스 상단 돌파 (종가 > 박스 상단 & 거래량 평균 2배+) — 최종 돌파
  E: 5일선 위 유지 (종가 > 5MA) — 눌림목 지지 확인

평일 20:55 KST 1회 실행.
ThreadPoolExecutor 병렬처리로 3~5분 내 완료.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import pytz

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.engine.models import BreakoutScreeningResult
from app.services.screening_progress import update_progress, reset_progress

KST = pytz.timezone("Asia/Seoul")
MAX_WORKERS = 8
SCREENING_DB_RETENTION_DAYS = 30


def _fetch_ohlcv(symbol: str) -> Optional[Tuple[str, object]]:
    """개별 종목 OHLCV 조회 (ThreadPoolExecutor에서 호출)"""
    from app.services.screening_price_source import warn_if_kiwoom_pending

    warn_if_kiwoom_pending()
    import FinanceDataReader as fdr

    try:
        df = fdr.DataReader(symbol)
        if df is not None and len(df) >= 130:
            return (symbol, df)
    except Exception:
        pass
    return None


def _analyze_stock_breakout(
    symbol: str,
    name: str,
    df,
    trading_value_rank: int,
    market_cap_억: float,
) -> Optional[Dict]:
    """
    매물 소화 후 돌파 조건 판정 (조건 B~E).
    조건 A(거래대금 상위)는 사전 필터로 이미 통과.
    """
    if len(df) < 130:
        return None

    df = df.reset_index(drop=True)
    curr = df.iloc[-1]

    matched = ["A"]  # 사전 필터 통과

    # --- 이동평균선 계산 ---
    df["MA5"] = df["Close"].rolling(window=5).mean()
    df["MA20"] = df["Close"].rolling(window=20).mean()

    ma5_val = df["MA5"].iloc[-1]
    ma20_val = df["MA20"].iloc[-1]

    # NaN 체크
    if ma5_val != ma5_val or ma20_val != ma20_val:
        return None

    # --- 20봉 박스권 분석 ---
    box_range = df.iloc[-21:-1]  # 최근 20거래일 (오늘 제외)
    box_max = box_range["High"].max()
    box_min = box_range["Low"].min()

    # [조건 B] 저점 상승 (최근 3봉 Low 지속 상승) — 에너지 축적
    if len(df) >= 4:
        low_3 = df["Low"].iloc[-3]
        low_2 = df["Low"].iloc[-2]
        low_1 = df["Low"].iloc[-1]
        if low_3 < low_2 < low_1:
            matched.append("B")

    # [조건 C] 박스 상단 2회+ 터치 (20봉 내 High가 box_max * 0.98 이상) — 매물 소화
    touch_count = len(box_range[box_range["High"] >= box_max * 0.98])
    if touch_count >= 2:
        matched.append("C")

    # [조건 D] 박스 상단 돌파 (종가 > box_max & 거래량 > 20일 평균 * 2) — 최종 돌파
    vol_mean_20 = df["Volume"].iloc[-21:-1].mean()
    if vol_mean_20 > 0:
        volume_ratio = curr["Volume"] / vol_mean_20
    else:
        volume_ratio = 0

    if curr["Close"] > box_max and volume_ratio >= 2.0:
        matched.append("D")

    # [조건 E] 5일선 위 유지 (종가 > 5MA) — 눌림목 지지
    if curr["Close"] > ma5_val:
        matched.append("E")

    # 모든 조건 충족 확인 (A~E)
    required = {"A", "B", "C", "D", "E"}
    if not required.issubset(set(matched)):
        return None

    # 등락률 계산
    if len(df) >= 2:
        prev_close = df.iloc[-2]["Close"]
        if prev_close > 0:
            change_pct = (curr["Close"] - prev_close) / prev_close * 100
        else:
            change_pct = 0
    else:
        change_pct = 0

    # 120봉 신고가 여부
    high_120 = df["High"].iloc[-120:].max() if len(df) >= 120 else df["High"].max()
    is_new_high = curr["Close"] >= high_120

    # 박스 범위 (%)
    if box_min > 0:
        box_range_pct = (box_max - box_min) / box_min * 100
    else:
        box_range_pct = 0

    # 거래대금 계산 (억원)
    trading_value = curr["Close"] * curr["Volume"] / 1_0000_0000

    return {
        "stock_code": symbol,
        "stock_name": name,
        "current_price": str(int(curr["Close"])),
        "change_percent": f"{change_pct:+.2f}%",
        "volume": str(int(curr["Volume"])) if "Volume" in curr.index else "",
        "ma5": str(int(ma5_val)),
        "ma20": str(int(ma20_val)),
        "box_high": str(int(box_max)),
        "box_low": str(int(box_min)),
        "box_range_pct": f"{box_range_pct:.1f}%",
        "touch_count": str(touch_count),
        "volume_ratio": f"{volume_ratio * 100:.0f}%",
        "trading_value": f"{trading_value:,.0f}",
        "trading_value_rank": trading_value_rank,
        "market_cap": f"{market_cap_억:,.0f}",
        "is_new_high_120": is_new_high,
        "matched_conditions": ",".join(matched),
    }


def _scan_market_breakout(market: str) -> List[Dict]:
    """
    매물 소화 돌파 스캔 (2-pass + 병렬처리):
    1) 시총 500억+ 필터
    2) 병렬로 OHLCV 조회 + 거래대금 계산
    3) 거래대금 상위 150위 필터
    4) 조건 B~E 판정
    """
    import FinanceDataReader as fdr

    listing_name = "KOSPI" if market == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception as e:
        print(f"[급등] {listing_name} 종목 리스트 조회 실패: {e}")
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
        print(f"[급등] {listing_name} 컬럼을 찾을 수 없습니다: {listing.columns.tolist()}")
        return []

    # [조건 A-1] 시총 500억 이상 필터
    marcap_col = None
    for candidate in ["Marcap", "MarketCap", "marcap", "marketcap"]:
        if candidate in listing.columns:
            marcap_col = candidate
            break
    if not marcap_col:
        print(f"[급등] 경고: {listing_name} 시총 컬럼 없음. 컬럼: {listing.columns.tolist()}")
        return []

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
    print(f"[급등] {market.upper()} 시총 500억+ 종목: {total}개 → 병렬 OHLCV 조회 시작")
    update_progress("breakout", phase=f"OHLCV 조회 ({market.upper()})", current=0, total=total,
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
                update_progress("breakout", phase=f"OHLCV 조회 ({market.upper()})",
                                current=done_count, total=total,
                                message=f"{market.upper()} OHLCV 조회 {done_count}/{total}")
                if done_count % 100 == 0:
                    print(f"[급등] {market.upper()} OHLCV 조회 {done_count}/{total}...")

    print(f"[급등] {market.upper()} OHLCV 조회 완료: {len(ohlcv_data)}/{total}개 성공")
    update_progress("breakout", phase=f"거래대금 순위 계산 ({market.upper()})",
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

    # [조건 A-2] 상위 150위 이내만 통과
    top_150 = trading_values[:150]

    # 2nd pass: 조건 B~E 판정
    results = []
    for rank_idx, (sym, name, mcap, tv, df) in enumerate(top_150, 1):
        try:
            result = _analyze_stock_breakout(sym, name, df, rank_idx, mcap)
            if result:
                results.append(result)
        except Exception:
            pass

    print(f"[급등] {market.upper()} 스캔 완료: {total}종목 → 거래대금 TOP150 → {len(results)}건 조건 충족")
    update_progress("breakout", phase=f"조건 판정 완료 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} {len(results)}건 조건 충족")
    return results


async def scan_all_stocks_breakout() -> Dict[str, List[Dict]]:
    """코스피/코스닥 매물 소화 돌파 스캔 (asyncio.to_thread)"""
    kospi_results = await asyncio.to_thread(_scan_market_breakout, "kospi")
    kosdaq_results = await asyncio.to_thread(_scan_market_breakout, "kosdaq")

    return {
        "kospi": kospi_results,
        "kosdaq": kosdaq_results,
    }


async def collect_and_save_breakout(db: Session) -> Dict[str, int]:
    """
    매물 소화 돌파 스크리닝 실행 후 DB에 저장.
    동일 기준일·시장 행만 덮어쓰고 과거 일자 스냅샷은 유지한다.
    """
    now_kst = datetime.now(KST)
    screening_date = now_kst.strftime("%Y-%m-%d")
    collected_at = now_kst.replace(second=0, microsecond=0)

    print(f"[급등] 스크리닝 시작 ({screening_date})")
    reset_progress("breakout")

    all_results = await scan_all_stocks_breakout()
    totals: Dict[str, int] = {}

    try:
        cutoff_str = (now_kst.date() - timedelta(days=SCREENING_DB_RETENTION_DAYS)).strftime("%Y-%m-%d")
        deleted_old = (
            db.query(BreakoutScreeningResult)
            .filter(BreakoutScreeningResult.screening_date < cutoff_str)
            .delete(synchronize_session=False)
        )
        if deleted_old:
            print(
                f"[급등] 기준일 {cutoff_str} 미만(보관 {SCREENING_DB_RETENTION_DAYS}일) {deleted_old}건 삭제 예정"
            )
    except Exception as e:
        print(f"[급등] 오래된 스크리닝 행 정리 실패(이번 저장은 계속): {e}")

    for market_type in ("kospi", "kosdaq"):
        items = all_results.get(market_type, [])

        db.query(BreakoutScreeningResult).filter(
            BreakoutScreeningResult.market_type == market_type,
            BreakoutScreeningResult.screening_date == screening_date,
        ).delete(synchronize_session=False)

        # 새 결과 저장 (순번 부여)
        for rank, item in enumerate(items, 1):
            row = BreakoutScreeningResult(
                market_type=market_type,
                rank=rank,
                stock_code=item["stock_code"],
                stock_name=item["stock_name"],
                current_price=item["current_price"],
                change_percent=item["change_percent"],
                volume=item["volume"],
                ma5=item["ma5"],
                ma20=item["ma20"],
                box_high=item["box_high"],
                box_low=item["box_low"],
                box_range_pct=item["box_range_pct"],
                touch_count=item["touch_count"],
                volume_ratio=item["volume_ratio"],
                trading_value=item["trading_value"],
                trading_value_rank=item["trading_value_rank"],
                market_cap=item["market_cap"],
                is_new_high_120=item["is_new_high_120"],
                matched_conditions=item["matched_conditions"],
                screening_date=screening_date,
                collected_at=collected_at,
            )
            db.add(row)

        totals[market_type] = len(items)
        print(f"[급등] {market_type.upper()} → {len(items)}개 저장")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[급등] DB 저장 오류: {e}")
        update_progress("breakout", status="error", phase="오류", message=f"DB 저장 오류: {e}")
        raise

    msg = f"완료: 코스피 {totals.get('kospi', 0)}건, 코스닥 {totals.get('kosdaq', 0)}건"
    print(f"[급등] 스크리닝 {msg}")
    update_progress("breakout", status="completed", phase="완료", current=1, total=1, message=msg)
    return totals


def list_breakout_screening_dates(db: Session, market_type: str, limit: int = 120) -> List[str]:
    rows = (
        db.query(BreakoutScreeningResult.screening_date)
        .filter(BreakoutScreeningResult.market_type == market_type)
        .distinct()
        .order_by(BreakoutScreeningResult.screening_date.desc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows if r[0]]


def get_latest_breakout_results(
    db: Session,
    market_type: str,
    limit: int = 50,
    screening_date: Optional[str] = None,
) -> Dict:
    """
    screening_date가 None이면 최신 수집분 1회분(앱 사용자용).
    지정 시 해당 기준일 스냅샷(BO 이력).
    """
    if screening_date:
        rows = (
            db.query(BreakoutScreeningResult)
            .filter(
                BreakoutScreeningResult.market_type == market_type,
                BreakoutScreeningResult.screening_date == screening_date,
            )
            .order_by(BreakoutScreeningResult.rank)
            .limit(limit)
            .all()
        )
        if not rows:
            return {"data": [], "screening_date": screening_date, "count": 0}
    else:
        latest_at = (
            db.query(func.max(BreakoutScreeningResult.collected_at))
            .filter(BreakoutScreeningResult.market_type == market_type)
            .scalar()
        )
        if not latest_at:
            return {"data": [], "screening_date": None, "count": 0}

        rows = (
            db.query(BreakoutScreeningResult)
            .filter(
                BreakoutScreeningResult.market_type == market_type,
                BreakoutScreeningResult.collected_at == latest_at,
            )
            .order_by(BreakoutScreeningResult.rank)
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
            "ma5": r.ma5,
            "ma20": r.ma20,
            "box_high": r.box_high,
            "box_low": r.box_low,
            "box_range_pct": r.box_range_pct,
            "touch_count": r.touch_count,
            "volume_ratio": r.volume_ratio,
            "trading_value": r.trading_value,
            "trading_value_rank": r.trading_value_rank,
            "market_cap": r.market_cap,
            "is_new_high_120": r.is_new_high_120,
            "matched_conditions": r.matched_conditions,
            "screening_date": r.screening_date,
        }
        for r in rows
    ]
    screening_date = rows[0].screening_date if rows else None
    return {"data": data, "screening_date": screening_date, "count": len(data)}
