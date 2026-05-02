"""
주도주 선정 검색식 서비스

업종별 거래대금 상위 1~3 섹터의 대장주를 선정하고,
상한가 패턴 분석, 매물대 소화, 이동평균선 돌파 등
기술적 지표를 종합 분석합니다.

스크리닝 조건 (6개):
  A: 업종 거래대금 상위 3 섹터 소속
  B: 종목 거래대금 >= 1,000억
  C: 당일 등락률 >= 10%
  D: 업종 내 등락률 1위 (대장주)
  E: 매물대 소화 점수 >= 50 (60일 볼륨프로파일 기반)
  F: 60MA 또는 120MA 돌파/상회

평일 21:10 KST 1회 실행.
ThreadPoolExecutor 병렬처리로 3~5분 내 완료.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np
import pytz
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.engine.models import LeaderScreeningResult
from app.services.screening_progress import update_progress, reset_progress

KST = pytz.timezone("Asia/Seoul")
MAX_WORKERS = 8
SCREENING_DB_RETENTION_DAYS = 30

TOP_SECTOR_COUNT = 3
MIN_TRADING_VALUE_억 = 1000
MIN_CHANGE_PCT = 10.0
MIN_VOLUME_PROFILE_SCORE = 50
UPPER_LIMIT_RATIO = 1.30
UPPER_LIMIT_TOLERANCE = 0.01


def _fetch_ohlcv(symbol: str) -> Optional[Tuple[str, object]]:
    import FinanceDataReader as fdr
    try:
        df = fdr.DataReader(symbol)
        if df is not None and len(df) >= 130:
            return (symbol, df)
    except Exception:
        pass
    return None


def _compute_volume_profile(df, bins: int = 20, lookback: int = 60) -> Tuple[int, str]:
    """
    최근 lookback일 OHLCV에서 가격대별 거래량 분포를 근사 계산.
    고거래량 가격대(매물대) 중 현재가가 돌파한 비율 → 점수화.
    """
    recent = df.iloc[-lookback:] if len(df) >= lookback else df
    if len(recent) < 10:
        return 0, "데이터 부족"

    price_min = recent["Low"].min()
    price_max = recent["High"].max()
    if price_max <= price_min:
        return 0, "가격 변동 없음"

    bin_edges = np.linspace(price_min, price_max, bins + 1)
    bin_volumes = np.zeros(bins)

    for _, row in recent.iterrows():
        low, high, vol = row["Low"], row["High"], row["Volume"]
        if high <= low or vol <= 0:
            continue
        for i in range(bins):
            overlap_low = max(low, bin_edges[i])
            overlap_high = min(high, bin_edges[i + 1])
            if overlap_high > overlap_low:
                fraction = (overlap_high - overlap_low) / (high - low)
                bin_volumes[i] += vol * fraction

    if bin_volumes.sum() == 0:
        return 0, "거래량 없음"

    top_n = min(3, bins)
    top_indices = np.argsort(bin_volumes)[-top_n:]

    current_price = df.iloc[-1]["Close"]
    absorbed = 0
    for idx in top_indices:
        if current_price > bin_edges[idx + 1]:
            absorbed += 1

    score = int((absorbed / top_n) * 100)
    detail = f"{top_n}개 매물대 중 {absorbed}개 돌파"
    return score, detail


def _detect_upper_limit_pattern(df) -> Tuple[str, str]:
    """
    상한가 패턴 감지.
    상한가 = round(전일종가 * 1.30), 1% 허용 오차.
    """
    if len(df) < 2:
        return "none", ""

    prev_close = df.iloc[-2]["Close"]
    curr = df.iloc[-1]
    upper_limit = round(prev_close * UPPER_LIMIT_RATIO)
    threshold = upper_limit * (1 - UPPER_LIMIT_TOLERANCE)

    if curr["Close"] < threshold:
        return "none", str(int(upper_limit))

    if abs(curr["High"] - curr["Low"]) < upper_limit * 0.005 and curr["Close"] >= threshold:
        return "pattern1", str(int(upper_limit))

    if curr["High"] >= threshold and curr["Low"] < upper_limit * 0.98 and curr["Close"] >= threshold:
        return "pattern2", str(int(upper_limit))

    if curr["Close"] >= threshold:
        return "pattern2", str(int(upper_limit))

    return "none", str(int(upper_limit))


def _analyze_stock_leader(
    symbol: str,
    name: str,
    df,
    sector_name: str,
    sector_rank: int,
    sector_trading_value_억: float,
    sector_stock_count: int,
    market_cap_억: float,
    change_pct: float,
    trading_value_억: float,
    is_sector_leader: bool,
) -> Optional[Dict]:
    """
    주도주 종합 분석 (조건 B~F + 상한가 패턴 + 점수 산출).
    조건 A(섹터 소속)와 D(업종 내 1위)는 사전 필터로 통과.
    """
    if len(df) < 130:
        return None

    df = df.reset_index(drop=True)
    curr = df.iloc[-1]
    matched = ["A"]

    if trading_value_억 >= MIN_TRADING_VALUE_억:
        matched.append("B")
    if change_pct >= MIN_CHANGE_PCT:
        matched.append("C")
    if is_sector_leader:
        matched.append("D")

    vp_score, vp_detail = _compute_volume_profile(df)
    if vp_score >= MIN_VOLUME_PROFILE_SCORE:
        matched.append("E")

    df["MA60"] = df["Close"].rolling(window=60).mean()
    df["MA120"] = df["Close"].rolling(window=120).mean()
    ma60_val = df["MA60"].iloc[-1]
    ma120_val = df["MA120"].iloc[-1]

    ma60_status = "below"
    ma120_status = "below"
    if ma60_val == ma60_val:
        if curr["Close"] > ma60_val * 1.02:
            ma60_status = "above"
        elif curr["Close"] > ma60_val * 0.98:
            ma60_status = "crossing"
    if ma120_val == ma120_val:
        if curr["Close"] > ma120_val * 1.02:
            ma120_status = "above"
        elif curr["Close"] > ma120_val * 0.98:
            ma120_status = "crossing"

    if ma60_status in ("above", "crossing") or ma120_status in ("above", "crossing"):
        matched.append("F")

    upper_pattern, upper_price = _detect_upper_limit_pattern(df)

    score = 0
    if change_pct >= 15:
        score += 40
    elif change_pct >= MIN_CHANGE_PCT:
        score += 30 + int((change_pct - 10) * 2)

    score += int(vp_score * 0.3)

    if ma60_status == "above":
        score += 15
    elif ma60_status == "crossing":
        score += 8
    if ma120_status == "above":
        score += 15
    elif ma120_status == "crossing":
        score += 8

    if upper_pattern == "pattern1":
        score += 10
    elif upper_pattern == "pattern2":
        score += 5

    score = min(score, 100)

    required = {"A", "C", "D"}
    if not required.issubset(set(matched)):
        return None

    return {
        "stock_code": symbol,
        "stock_name": name,
        "current_price": str(int(curr["Close"])),
        "change_percent": f"{change_pct:.2f}",
        "volume": str(int(curr["Volume"])),
        "sector_name": sector_name,
        "sector_rank": sector_rank,
        "sector_trading_value": f"{sector_trading_value_억:.0f}",
        "sector_stock_count": sector_stock_count,
        "trading_value": f"{trading_value_억:.0f}",
        "market_cap": f"{market_cap_억:.0f}",
        "upper_limit_pattern": upper_pattern,
        "upper_limit_price": upper_price,
        "volume_profile_score": str(vp_score),
        "volume_profile_detail": vp_detail,
        "ma60": f"{ma60_val:.0f}" if ma60_val == ma60_val else "",
        "ma120": f"{ma120_val:.0f}" if ma120_val == ma120_val else "",
        "ma60_breakthrough": ma60_status,
        "ma120_breakthrough": ma120_status,
        "leader_score": score,
        "matched_conditions": ",".join(matched),
    }


def _scan_market_leader(market: str) -> List[Dict]:
    """
    업종 주도주 스캔 (3-pass):
    1) 시총 500억+ 필터 → 병렬 OHLCV 조회
    2) 섹터별 거래대금 집계 → 상위 3섹터 → 섹터 내 대장주
    3) 대장주 기술적 분석
    """
    import FinanceDataReader as fdr

    listing_name = "KOSPI" if market == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception as e:
        print(f"[주도주] {listing_name} 종목 리스트 조회 실패: {e}")
        return []

    code_col = next((c for c in ["Code", "Symbol", "code", "symbol"] if c in listing.columns), None)
    name_col = next((c for c in ["Name", "name", "종목명"] if c in listing.columns), None)
    marcap_col = next((c for c in ["Marcap", "MarketCap", "marcap", "marketcap"] if c in listing.columns), None)
    sector_col = next((c for c in ["Sector", "Industry", "sector", "industry", "Dept"] if c in listing.columns), None)

    if not code_col or not name_col or not marcap_col:
        print(f"[주도주] {listing_name} 필수 컬럼 없음: {listing.columns.tolist()}")
        return []

    if not sector_col:
        print(f"[주도주] {listing_name} 섹터 컬럼 없음 → 전체를 단일 그룹으로 처리")

    listing = listing[listing[marcap_col] >= 500 * 1_0000_0000].copy()
    listing["market_cap_억"] = listing[marcap_col] / 1_0000_0000

    symbols_info = []
    for _, row in listing.iterrows():
        symbol = str(row[code_col]).strip()
        name = str(row[name_col]).strip()
        mcap = row["market_cap_억"]
        sector = str(row[sector_col]).strip() if sector_col and row.get(sector_col) else "기타"
        if symbol and len(symbol) == 6:
            symbols_info.append((symbol, name, mcap, sector))

    total = len(symbols_info)
    print(f"[주도주] {market.upper()} 시총 500억+ 종목: {total}개 → 병렬 OHLCV 조회 시작")
    update_progress("leader", phase=f"OHLCV 조회 ({market.upper()})", current=0, total=total,
                    message=f"{market.upper()} {total}개 종목 OHLCV 조회 시작")

    # Pass 1: 병렬 OHLCV 조회
    ohlcv_data = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(_fetch_ohlcv, sym): (sym, name, mcap, sector)
            for sym, name, mcap, sector in symbols_info
        }
        done_count = 0
        for future in futures:
            result = future.result()
            done_count += 1
            if result:
                sym, df = result
                ohlcv_data[sym] = df
            if done_count % 50 == 0 or done_count == total:
                update_progress("leader", phase=f"OHLCV 조회 ({market.upper()})",
                                current=done_count, total=total,
                                message=f"{market.upper()} OHLCV 조회 {done_count}/{total}")
                if done_count % 100 == 0:
                    print(f"[주도주] {market.upper()} OHLCV 조회 {done_count}/{total}...")

    print(f"[주도주] {market.upper()} OHLCV 조회 완료: {len(ohlcv_data)}/{total}개 성공")
    update_progress("leader", phase=f"섹터 집계 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} 섹터별 거래대금 집계 중...")

    # Pass 2: 섹터별 거래대금 집계 + 대장주 선정
    stocks_with_data = []
    for sym, name, mcap, sector in symbols_info:
        if sym not in ohlcv_data:
            continue
        df = ohlcv_data[sym]
        curr = df.iloc[-1]
        prev = df.iloc[-2]
        tv = curr["Close"] * curr["Volume"]
        tv_억 = tv / 1_0000_0000
        change_pct = ((curr["Close"] - prev["Close"]) / prev["Close"] * 100) if prev["Close"] > 0 else 0
        stocks_with_data.append({
            "symbol": sym, "name": name, "mcap": mcap, "sector": sector,
            "tv_억": tv_억, "change_pct": change_pct, "df": df,
        })

    sector_agg = {}
    for s in stocks_with_data:
        sec = s["sector"]
        if sec not in sector_agg:
            sector_agg[sec] = {"total_tv": 0, "stocks": [], "count": 0}
        sector_agg[sec]["total_tv"] += s["tv_억"]
        sector_agg[sec]["stocks"].append(s)
        sector_agg[sec]["count"] += 1

    sorted_sectors = sorted(sector_agg.items(), key=lambda x: x[1]["total_tv"], reverse=True)
    top_sectors = sorted_sectors[:TOP_SECTOR_COUNT]

    print(f"[주도주] {market.upper()} 섹터 거래대금 TOP {TOP_SECTOR_COUNT}:")
    for i, (sec_name, sec_data) in enumerate(top_sectors, 1):
        print(f"  {i}위: {sec_name} (거래대금 {sec_data['total_tv']:.0f}억, {sec_data['count']}종목)")

    # Pass 3: 섹터 내 대장주 분석
    results = []
    update_progress("leader", phase=f"종목 분석 ({market.upper()})",
                    current=0, total=len(top_sectors),
                    message=f"{market.upper()} 업종 대장주 분석 중...")

    for sector_rank, (sec_name, sec_data) in enumerate(top_sectors, 1):
        sector_stocks = sorted(sec_data["stocks"], key=lambda x: x["change_pct"], reverse=True)

        for stock_rank, s in enumerate(sector_stocks[:5]):
            is_leader = stock_rank == 0
            if s["change_pct"] < MIN_CHANGE_PCT:
                continue

            result = _analyze_stock_leader(
                symbol=s["symbol"],
                name=s["name"],
                df=s["df"],
                sector_name=sec_name,
                sector_rank=sector_rank,
                sector_trading_value_억=sec_data["total_tv"],
                sector_stock_count=sec_data["count"],
                market_cap_억=s["mcap"],
                change_pct=s["change_pct"],
                trading_value_억=s["tv_억"],
                is_sector_leader=is_leader,
            )
            if result:
                results.append(result)

        update_progress("leader", phase=f"종목 분석 ({market.upper()})",
                        current=sector_rank, total=len(top_sectors),
                        message=f"{market.upper()} {sec_name} 분석 완료")

    results.sort(key=lambda x: x["leader_score"], reverse=True)
    print(f"[주도주] {market.upper()} 스캔 완료: {total}종목 → 섹터 TOP{TOP_SECTOR_COUNT} → {len(results)}건 조건 충족")
    update_progress("leader", phase=f"조건 판정 완료 ({market.upper()})",
                    current=total, total=total,
                    message=f"{market.upper()} {len(results)}건 조건 충족")
    return results


async def scan_all_stocks_leader() -> Dict[str, List[Dict]]:
    kospi_results = await asyncio.to_thread(_scan_market_leader, "kospi")
    kosdaq_results = await asyncio.to_thread(_scan_market_leader, "kosdaq")
    return {"kospi": kospi_results, "kosdaq": kosdaq_results}


async def collect_and_save_leader(db: Session) -> Dict[str, int]:
    now_kst = datetime.now(KST)
    screening_date = now_kst.strftime("%Y-%m-%d")
    collected_at = now_kst.replace(second=0, microsecond=0)

    print(f"[주도주] 스크리닝 시작 ({screening_date})")
    reset_progress("leader")

    all_results = await scan_all_stocks_leader()
    totals: Dict[str, int] = {}

    try:
        cutoff_str = (now_kst.date() - timedelta(days=SCREENING_DB_RETENTION_DAYS)).strftime("%Y-%m-%d")
        deleted_old = (
            db.query(LeaderScreeningResult)
            .filter(LeaderScreeningResult.screening_date < cutoff_str)
            .delete(synchronize_session=False)
        )
        if deleted_old:
            print(f"[주도주] {cutoff_str} 미만 {deleted_old}건 삭제")
    except Exception as e:
        print(f"[주도주] 오래된 행 정리 실패: {e}")

    for market_type in ("kospi", "kosdaq"):
        items = all_results.get(market_type, [])

        db.query(LeaderScreeningResult).filter(
            LeaderScreeningResult.market_type == market_type,
            LeaderScreeningResult.screening_date == screening_date,
        ).delete(synchronize_session=False)

        for rank, item in enumerate(items, 1):
            row = LeaderScreeningResult(
                market_type=market_type,
                rank=rank,
                stock_code=item["stock_code"],
                stock_name=item["stock_name"],
                current_price=item["current_price"],
                change_percent=item["change_percent"],
                volume=item["volume"],
                sector_name=item["sector_name"],
                sector_rank=item["sector_rank"],
                sector_trading_value=item["sector_trading_value"],
                sector_stock_count=item["sector_stock_count"],
                trading_value=item["trading_value"],
                market_cap=item["market_cap"],
                upper_limit_pattern=item["upper_limit_pattern"],
                upper_limit_price=item["upper_limit_price"],
                volume_profile_score=item["volume_profile_score"],
                volume_profile_detail=item["volume_profile_detail"],
                ma60=item["ma60"],
                ma120=item["ma120"],
                ma60_breakthrough=item["ma60_breakthrough"],
                ma120_breakthrough=item["ma120_breakthrough"],
                leader_score=item["leader_score"],
                matched_conditions=item["matched_conditions"],
                screening_date=screening_date,
                collected_at=collected_at,
            )
            db.add(row)

        totals[market_type] = len(items)
        print(f"[주도주] {market_type.upper()} → {len(items)}개 저장")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[주도주] DB 저장 오류: {e}")
        update_progress("leader", status="error", phase="오류", message=f"DB 저장 오류: {e}")
        raise

    msg = f"완료: 코스피 {totals.get('kospi', 0)}건, 코스닥 {totals.get('kosdaq', 0)}건"
    print(f"[주도주] 스크리닝 {msg}")
    update_progress("leader", status="completed", phase="완료", current=1, total=1, message=msg)
    return totals


def list_leader_screening_dates(db: Session, market_type: str, limit: int = 120) -> List[str]:
    rows = (
        db.query(LeaderScreeningResult.screening_date)
        .filter(LeaderScreeningResult.market_type == market_type)
        .distinct()
        .order_by(LeaderScreeningResult.screening_date.desc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows if r[0]]


def get_latest_leader_results(
    db: Session,
    market_type: str,
    limit: int = 50,
    screening_date: Optional[str] = None,
) -> Dict:
    if screening_date:
        rows = (
            db.query(LeaderScreeningResult)
            .filter(
                LeaderScreeningResult.market_type == market_type,
                LeaderScreeningResult.screening_date == screening_date,
            )
            .order_by(LeaderScreeningResult.rank)
            .limit(limit)
            .all()
        )
        if not rows:
            return {"data": [], "screening_date": screening_date, "count": 0}
    else:
        latest_at = (
            db.query(func.max(LeaderScreeningResult.collected_at))
            .filter(LeaderScreeningResult.market_type == market_type)
            .scalar()
        )
        if not latest_at:
            return {"data": [], "screening_date": None, "count": 0}

        rows = (
            db.query(LeaderScreeningResult)
            .filter(
                LeaderScreeningResult.market_type == market_type,
                LeaderScreeningResult.collected_at == latest_at,
            )
            .order_by(LeaderScreeningResult.rank)
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
            "sector_name": r.sector_name,
            "sector_rank": r.sector_rank,
            "sector_trading_value": r.sector_trading_value,
            "sector_stock_count": r.sector_stock_count,
            "trading_value": r.trading_value,
            "market_cap": r.market_cap,
            "upper_limit_pattern": r.upper_limit_pattern,
            "upper_limit_price": r.upper_limit_price,
            "volume_profile_score": r.volume_profile_score,
            "volume_profile_detail": r.volume_profile_detail,
            "ma60": r.ma60,
            "ma120": r.ma120,
            "ma60_breakthrough": r.ma60_breakthrough,
            "ma120_breakthrough": r.ma120_breakthrough,
            "leader_score": r.leader_score,
            "matched_conditions": r.matched_conditions,
            "screening_date": r.screening_date,
        }
        for r in rows
    ]
    sd = rows[0].screening_date if rows else screening_date
    return {"data": data, "screening_date": sd, "count": len(data)}
