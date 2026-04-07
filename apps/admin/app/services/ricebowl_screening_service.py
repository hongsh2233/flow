"""
밥그릇(U자형 반등) 검색식 서비스

키움증권 [0150] 기준 밥그릇 패턴 검색식.
장기 이평선(224일선)을 기준으로 과거 급락 후 횡보를 거쳐
추세 전환하는 종목을 스크리닝합니다.

스크리닝 조건 (7개 전량 충족):
  A: 224일전 종가 > 현재가 * 1.5 (과거 급락 증명)
  B: 종가 > 224일 이평선 (횡보 종료, 머리 드는 시점)
  C: 20일 이평과 60일 이평이 5% 이내 근접 (매집 에너지 응축)
  D: 전일 대비 등락률 3% ~ 15% (기준봉 출현)
  E: 전일 대비 거래량 300% 이상 (세력 개입)
  F: 최근 60봉 중 최고 종가 돌파 (매물대 돌파)
  G: 구름대(선행스팬1,2) 위에 위치 (장기 저항대 돌파)

평일 20:45 KST 1회 실행.
ThreadPoolExecutor 병렬처리로 3~5분 내 완료.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import pytz

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.engine.models import RicebowlScreeningResult
from app.services.screening_progress import update_progress, reset_progress

KST = pytz.timezone("Asia/Seoul")
MAX_WORKERS = 8
SCREENING_DB_RETENTION_DAYS = 30


def _ichimoku(high, low, close, tenkan=9, kijun=26, senkou_b=52):
    """일목균형표 계산 (선행스팬 A/B)"""
    tenkan_sen = (high.rolling(window=tenkan).max() + low.rolling(window=tenkan).min()) / 2
    kijun_sen = (high.rolling(window=kijun).max() + low.rolling(window=kijun).min()) / 2
    senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(kijun)
    senkou_span_b = ((high.rolling(window=senkou_b).max() + low.rolling(window=senkou_b).min()) / 2).shift(kijun)
    return senkou_span_a, senkou_span_b


def _fetch_ohlcv(symbol: str) -> Optional[Tuple[str, object]]:
    """개별 종목 OHLCV 조회 (ThreadPoolExecutor에서 호출)"""
    import FinanceDataReader as fdr

    try:
        df = fdr.DataReader(symbol)
        if df is not None and len(df) >= 250:
            return (symbol, df)
    except Exception:
        pass
    return None


def _analyze_stock_ricebowl(
    symbol: str,
    name: str,
    df,
    market_cap_억: float,
) -> Optional[Dict]:
    """
    밥그릇 패턴 조건 판정 (조건 A~G).
    224일 이상의 데이터가 필요합니다.
    """
    if len(df) < 250:
        return None

    df = df.reset_index(drop=True)
    curr = df.iloc[-1]

    matched = []

    # --- 이동평균선 계산 ---
    df["MA20"] = df["Close"].rolling(window=20).mean()
    df["MA60"] = df["Close"].rolling(window=60).mean()
    df["MA224"] = df["Close"].rolling(window=224).mean()

    ma20_val = df["MA20"].iloc[-1]
    ma60_val = df["MA60"].iloc[-1]
    ma224_val = df["MA224"].iloc[-1]

    # NaN 체크
    if any(v != v for v in [ma20_val, ma60_val, ma224_val]):
        return None

    # [조건 A] 224일전 종가 > 현재가 * 1.5 (과거 급락 증명)
    if len(df) >= 225:
        past_close = df.iloc[-225]["Close"]
        if past_close > curr["Close"] * 1.5:
            matched.append("A")

    # [조건 B] 종가 > 224일 이평선 (횡보 종료, 머리 드는 시점)
    if curr["Close"] > ma224_val:
        matched.append("B")

    # [조건 C] 20일 이평과 60일 이평이 5% 이내 근접 (매집 에너지 응축)
    if ma60_val > 0:
        ma_gap = abs(ma20_val - ma60_val) / ma60_val * 100
        if ma_gap <= 5.0:
            matched.append("C")
    else:
        ma_gap = 0

    # [조건 D] 전일 대비 등락률 3% ~ 15% (기준봉 출현)
    if len(df) >= 2:
        prev_close = df.iloc[-2]["Close"]
        if prev_close > 0:
            change_pct = (curr["Close"] - prev_close) / prev_close * 100
        else:
            change_pct = 0
    else:
        change_pct = 0

    if 3 <= change_pct <= 15:
        matched.append("D")

    # [조건 E] 전일 대비 거래량 300% 이상 (세력 개입)
    if len(df) >= 2:
        prev_volume = df.iloc[-2]["Volume"]
        curr_volume = curr["Volume"]
        if prev_volume > 0:
            volume_ratio = curr_volume / prev_volume
            if volume_ratio >= 3.0:
                matched.append("E")
        else:
            volume_ratio = 0
    else:
        volume_ratio = 0

    # [조건 F] 최근 60봉 중 최고 종가 돌파 (매물대 돌파)
    recent_60_high = df["Close"].iloc[-61:-1].max() if len(df) >= 62 else df["Close"].iloc[:-1].max()
    if curr["Close"] > recent_60_high:
        matched.append("F")

    # [조건 G] 일목균형표 구름대 위 (선행스팬1, 선행스팬2 위에 위치)
    span_a, span_b = _ichimoku(df["High"], df["Low"], df["Close"])
    span_a_val = span_a.iloc[-1] if len(span_a) > 0 else float("nan")
    span_b_val = span_b.iloc[-1] if len(span_b) > 0 else float("nan")

    if not (span_a_val != span_a_val) and not (span_b_val != span_b_val):
        if curr["Close"] > span_a_val and curr["Close"] > span_b_val:
            matched.append("G")

    # 모든 조건 충족 확인 (A~G)
    required = {"A", "B", "C", "D", "E", "F", "G"}
    if not required.issubset(set(matched)):
        return None

    # 거래대금 계산 (억원)
    trading_value = curr["Close"] * curr["Volume"] / 1_0000_0000

    return {
        "stock_code": symbol,
        "stock_name": name,
        "current_price": str(int(curr["Close"])),
        "change_percent": f"{change_pct:+.2f}%",
        "volume": str(int(curr["Volume"])) if "Volume" in curr.index else "",
        "ma20": str(int(ma20_val)),
        "ma60": str(int(ma60_val)),
        "ma224": str(int(ma224_val)),
        "ma_gap": f"{ma_gap:.1f}%",
        "volume_ratio": f"{volume_ratio * 100:.0f}%",
        "trading_value": f"{trading_value:,.0f}",
        "market_cap": f"{market_cap_억:,.0f}",
        "cloud_position": "above",
        "matched_conditions": ",".join(matched),
    }


def _scan_market_ricebowl(market: str) -> List[Dict]:
    """
    밥그릇 패턴 스캔 (병렬처리):
    1) 시총 300억+ 필터
    2) 병렬로 OHLCV 조회 (224일+ 데이터 필요)
    3) 조건 A~G 판정
    """
    import FinanceDataReader as fdr

    listing_name = "KOSPI" if market == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception as e:
        print(f"[밥그릇] {listing_name} 종목 리스트 조회 실패: {e}")
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
        print(f"[밥그릇] {listing_name} 컬럼을 찾을 수 없습니다: {listing.columns.tolist()}")
        return []

    # 시총 컬럼 찾기
    marcap_col = None
    for candidate in ["Marcap", "MarketCap", "marcap", "marketcap"]:
        if candidate in listing.columns:
            marcap_col = candidate
            break
    if not marcap_col:
        print(f"[밥그릇] 경고: {listing_name} 시총 컬럼 없음. 컬럼: {listing.columns.tolist()}")
        return []

    # 시총 300억 이상 필터 (밥그릇 패턴은 중소형주에서도 발생)
    listing = listing[listing[marcap_col] >= 300 * 1_0000_0000].copy()
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
    print(f"[밥그릇] {market.upper()} 시총 300억+ 종목: {total}개 → 병렬 OHLCV 조회 시작")
    update_progress("ricebowl", phase=f"OHLCV 조회 ({market.upper()})", current=0, total=total,
                    message=f"{market.upper()} {total}개 종목 OHLCV 조회 시작")

    # 병렬로 OHLCV 조회
    ohlcv_data = {}  # symbol -> (df, name, mcap)
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
                _, name, mcap = futures[future]
                ohlcv_data[sym] = (df, name, mcap)
            if done_count % 50 == 0 or done_count == total:
                update_progress("ricebowl", phase=f"OHLCV 조회 ({market.upper()})",
                                current=done_count, total=total,
                                message=f"{market.upper()} OHLCV 조회 {done_count}/{total}")
                if done_count % 100 == 0:
                    print(f"[밥그릇] {market.upper()} OHLCV 조회 {done_count}/{total}...")

    print(f"[밥그릇] {market.upper()} OHLCV 조회 완료: {len(ohlcv_data)}/{total}개 성공")
    update_progress("ricebowl", phase=f"조건 판정 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} 밥그릇 조건 판정 중...")

    # 조건 A~G 판정
    results = []
    for sym, (df, name, mcap) in ohlcv_data.items():
        try:
            result = _analyze_stock_ricebowl(sym, name, df, mcap)
            if result:
                results.append(result)
        except Exception:
            pass

    # 거래대금 내림차순 정렬
    results.sort(key=lambda x: float(x["trading_value"].replace(",", "")), reverse=True)

    print(f"[밥그릇] {market.upper()} 스캔 완료: {total}종목 → {len(results)}건 조건 충족")
    update_progress("ricebowl", phase=f"조건 판정 완료 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} {len(results)}건 조건 충족")
    return results


async def scan_all_stocks_ricebowl() -> Dict[str, List[Dict]]:
    """코스피/코스닥 밥그릇 패턴 스캔 (asyncio.to_thread)"""
    kospi_results = await asyncio.to_thread(_scan_market_ricebowl, "kospi")
    kosdaq_results = await asyncio.to_thread(_scan_market_ricebowl, "kosdaq")

    return {
        "kospi": kospi_results,
        "kosdaq": kosdaq_results,
    }


async def collect_and_save_ricebowl(db: Session) -> Dict[str, int]:
    """
    밥그릇 스크리닝 실행 후 DB에 저장.
    동일 기준일·시장 행만 덮어쓰고 과거 일자 스냅샷은 유지한다.
    """
    now_kst = datetime.now(KST)
    screening_date = now_kst.strftime("%Y-%m-%d")
    collected_at = now_kst.replace(second=0, microsecond=0)

    print(f"[밥그릇] 스크리닝 시작 ({screening_date})")
    reset_progress("ricebowl")

    all_results = await scan_all_stocks_ricebowl()
    totals: Dict[str, int] = {}

    try:
        cutoff_str = (now_kst.date() - timedelta(days=SCREENING_DB_RETENTION_DAYS)).strftime("%Y-%m-%d")
        deleted_old = (
            db.query(RicebowlScreeningResult)
            .filter(RicebowlScreeningResult.screening_date < cutoff_str)
            .delete(synchronize_session=False)
        )
        if deleted_old:
            print(
                f"[밥그릇] 기준일 {cutoff_str} 미만(보관 {SCREENING_DB_RETENTION_DAYS}일) {deleted_old}건 삭제 예정"
            )
    except Exception as e:
        print(f"[밥그릇] 오래된 스크리닝 행 정리 실패(이번 저장은 계속): {e}")

    for market_type in ("kospi", "kosdaq"):
        items = all_results.get(market_type, [])

        db.query(RicebowlScreeningResult).filter(
            RicebowlScreeningResult.market_type == market_type,
            RicebowlScreeningResult.screening_date == screening_date,
        ).delete(synchronize_session=False)

        # 새 결과 저장 (순번 부여)
        for rank, item in enumerate(items, 1):
            row = RicebowlScreeningResult(
                market_type=market_type,
                rank=rank,
                stock_code=item["stock_code"],
                stock_name=item["stock_name"],
                current_price=item["current_price"],
                change_percent=item["change_percent"],
                volume=item["volume"],
                ma20=item["ma20"],
                ma60=item["ma60"],
                ma224=item["ma224"],
                ma_gap=item["ma_gap"],
                volume_ratio=item["volume_ratio"],
                trading_value=item["trading_value"],
                market_cap=item["market_cap"],
                cloud_position=item["cloud_position"],
                matched_conditions=item["matched_conditions"],
                screening_date=screening_date,
                collected_at=collected_at,
            )
            db.add(row)

        totals[market_type] = len(items)
        print(f"[밥그릇] {market_type.upper()} → {len(items)}개 저장")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[밥그릇] DB 저장 오류: {e}")
        update_progress("ricebowl", status="error", phase="오류", message=f"DB 저장 오류: {e}")
        raise

    msg = f"완료: 코스피 {totals.get('kospi', 0)}건, 코스닥 {totals.get('kosdaq', 0)}건"
    print(f"[밥그릇] 스크리닝 {msg}")
    update_progress("ricebowl", status="completed", phase="완료", current=1, total=1, message=msg)
    return totals


def list_ricebowl_screening_dates(db: Session, market_type: str, limit: int = 120) -> List[str]:
    rows = (
        db.query(RicebowlScreeningResult.screening_date)
        .filter(RicebowlScreeningResult.market_type == market_type)
        .distinct()
        .order_by(RicebowlScreeningResult.screening_date.desc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows if r[0]]


def get_latest_ricebowl_results(
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
            db.query(RicebowlScreeningResult)
            .filter(
                RicebowlScreeningResult.market_type == market_type,
                RicebowlScreeningResult.screening_date == screening_date,
            )
            .order_by(RicebowlScreeningResult.rank)
            .limit(limit)
            .all()
        )
        if not rows:
            return {"data": [], "screening_date": screening_date, "count": 0}
    else:
        latest_at = (
            db.query(func.max(RicebowlScreeningResult.collected_at))
            .filter(RicebowlScreeningResult.market_type == market_type)
            .scalar()
        )
        if not latest_at:
            return {"data": [], "screening_date": None, "count": 0}

        rows = (
            db.query(RicebowlScreeningResult)
            .filter(
                RicebowlScreeningResult.market_type == market_type,
                RicebowlScreeningResult.collected_at == latest_at,
            )
            .order_by(RicebowlScreeningResult.rank)
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
            "ma20": r.ma20,
            "ma60": r.ma60,
            "ma224": r.ma224,
            "ma_gap": r.ma_gap,
            "volume_ratio": r.volume_ratio,
            "trading_value": r.trading_value,
            "market_cap": r.market_cap,
            "cloud_position": r.cloud_position,
            "matched_conditions": r.matched_conditions,
            "screening_date": r.screening_date,
        }
        for r in rows
    ]
    screening_date = rows[0].screening_date if rows else None
    return {"data": data, "screening_date": screening_date, "count": len(data)}
