"""
기술적 지표 기반 조건검색 서비스 (익일 매수 후보 스크리닝)

FinanceDataReader + pandas_ta를 사용하여 시총 상위 500종목을 분석합니다.
평일 20:30 KST 1회 실행.

스크리닝 조건:
  A: 2봉전 종가 > 전환선 (추세 유지)
  B/C/D: 현재가 또는 저가가 전환선 1% 이내 근접 (지지선 터치)
  E/F: 종가 > 선행스팬1 AND 종가 > 선행스팬2 (구름대 위)
  G: 양봉 (종가 > 시가)
  J: 최근 20봉 내 120봉 신고가 존재 (강한 추세)
"""
import asyncio
import traceback
from datetime import datetime
from typing import Dict, List, Optional

import pytz

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.engine.models import StockScreeningResult

KST = pytz.timezone("Asia/Seoul")


def _analyze_stock(symbol: str, name: str) -> Optional[Dict]:
    """
    개별 종목에 대해 기술적 조건을 판정한다.
    모든 조건 충족 시 결과 dict 반환, 미충족 시 None.
    """
    import FinanceDataReader as fdr
    import pandas_ta as ta

    try:
        df = fdr.DataReader(symbol)
    except Exception:
        return None

    if df is None or len(df) < 250:
        return None

    # --- 일목균형표 계산 (9, 26, 52) ---
    try:
        ichimoku_result = ta.ichimoku(df["High"], df["Low"], df["Close"])
        if ichimoku_result is None or ichimoku_result[0] is None:
            return None
        ichimoku = ichimoku_result[0]
    except Exception:
        return None

    # pandas_ta 일목균형표 컬럼명
    tenkan_col = None
    kijun_col = None
    span_a_col = None
    span_b_col = None
    for col in ichimoku.columns:
        if col.startswith("ITS_"):
            tenkan_col = col
        elif col.startswith("IKS_"):
            kijun_col = col
        elif col.startswith("ISA_"):
            span_a_col = col
        elif col.startswith("ISB_"):
            span_b_col = col

    if not all([tenkan_col, kijun_col, span_a_col, span_b_col]):
        return None

    df["tenkan_sen"] = ichimoku[tenkan_col]
    df["kijun_sen"] = ichimoku[kijun_col]
    df["span1"] = ichimoku[span_a_col]
    df["span2"] = ichimoku[span_b_col]

    # --- 120봉 신고가 ---
    df["high_120"] = df["High"].rolling(window=120).max()

    # NaN 행 제거 후 데이터 충분한지 확인
    df = df.dropna(subset=["tenkan_sen", "kijun_sen", "span1", "span2", "high_120"])
    if len(df) < 3:
        return None

    curr = df.iloc[-1]
    prev2 = df.iloc[-3]

    matched = []

    # [조건 A] 2봉전 종가 > 전환선
    if prev2["Close"] > prev2["tenkan_sen"]:
        matched.append("A")

    # [조건 B/C/D] 현재가 또는 저가가 전환선 1% 이내 근접
    limit = curr["tenkan_sen"] * 0.01
    if (abs(curr["Close"] - curr["tenkan_sen"]) <= limit) or \
       (abs(curr["Low"] - curr["tenkan_sen"]) <= limit):
        matched.append("B")

    # [조건 E/F] 구름대 위 (종가 > 선행스팬1 AND 선행스팬2)
    if curr["Close"] > curr["span1"] and curr["Close"] > curr["span2"]:
        matched.append("E")

    # [조건 G] 양봉 (종가 > 시가)
    if curr["Close"] > curr["Open"]:
        matched.append("G")

    # [조건 J] 최근 20봉 내 120봉 신고가
    recent_highs = df["High"].iloc[-20:]
    high_120_ref = df["high_120"].iloc[-21] if len(df) >= 21 else df["high_120"].iloc[0]
    if recent_highs.max() >= high_120_ref:
        matched.append("J")

    # 모든 조건 충족 확인 (A, B, E, G, J)
    required = {"A", "B", "E", "G", "J"}
    if not required.issubset(set(matched)):
        return None

    # 등락률 계산
    if len(df) >= 2:
        prev_close = df.iloc[-2]["Close"]
        change_pct = ((curr["Close"] - prev_close) / prev_close * 100) if prev_close > 0 else 0
    else:
        change_pct = 0

    return {
        "stock_code": symbol,
        "stock_name": name,
        "current_price": str(int(curr["Close"])),
        "change_percent": f"{change_pct:+.2f}%",
        "volume": str(int(curr["Volume"])) if "Volume" in curr.index else "",
        "tenkan_sen": str(int(curr["tenkan_sen"])),
        "kijun_sen": str(int(curr["kijun_sen"])),
        "cloud_position": "above",
        "is_new_high_120": "J" in matched,
        "matched_conditions": ",".join(matched),
    }


def _scan_market(market: str, top_n: int = 500) -> List[Dict]:
    """시총 상위 top_n 종목을 스캔하여 조건 충족 종목 리스트 반환"""
    import FinanceDataReader as fdr

    listing_name = "KOSPI" if market == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception as e:
        print(f"[조건검색] {listing_name} 종목 리스트 조회 실패: {e}")
        return []

    # 시총 기준 정렬 → 상위 top_n
    if "MarketCap" in listing.columns:
        listing = listing.sort_values("MarketCap", ascending=False)
    listing = listing.head(top_n)

    # Code/Symbol 컬럼 찾기
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
        print(f"[조건검색] {listing_name} 종목 리스트 컬럼을 찾을 수 없습니다: {listing.columns.tolist()}")
        return []

    results = []
    total = len(listing)
    for idx, (_, row) in enumerate(listing.iterrows(), 1):
        symbol = str(row[code_col]).strip()
        name = str(row[name_col]).strip()

        if not symbol or len(symbol) != 6:
            continue

        try:
            result = _analyze_stock(symbol, name)
            if result:
                results.append(result)
        except Exception as e:
            # 개별 종목 오류는 skip
            if idx % 100 == 0:
                print(f"[조건검색] {market.upper()} {idx}/{total} 진행중... (현재까지 {len(results)}건 발견)")
            continue

        if idx % 100 == 0:
            print(f"[조건검색] {market.upper()} {idx}/{total} 진행중... (현재까지 {len(results)}건 발견)")

    print(f"[조건검색] {market.upper()} 스캔 완료: {total}종목 → {len(results)}건 조건 충족")
    return results


async def scan_all_stocks(top_n: int = 500) -> Dict[str, List[Dict]]:
    """
    코스피/코스닥 시총 상위 종목을 스캔한다.
    동기 함수를 asyncio.to_thread로 래핑하여 이벤트 루프 블로킹 방지.
    """
    kospi_results = await asyncio.to_thread(_scan_market, "kospi", top_n)
    kosdaq_results = await asyncio.to_thread(_scan_market, "kosdaq", top_n)

    return {
        "kospi": kospi_results,
        "kosdaq": kosdaq_results,
    }


async def collect_and_save(db: Session, top_n: int = 500) -> Dict[str, int]:
    """
    전체 스크리닝 실행 후 DB에 저장.
    기존 결과를 삭제하고 최신 결과만 보관한다 (NaverRisingStock 패턴).
    """
    now_kst = datetime.now(KST)
    screening_date = now_kst.strftime("%Y-%m-%d")
    collected_at = now_kst.replace(second=0, microsecond=0)

    print(f"[조건검색] 스크리닝 시작 ({screening_date}, 시총 상위 {top_n}종목)")

    all_results = await scan_all_stocks(top_n=top_n)
    totals: Dict[str, int] = {}

    for market_type in ("kospi", "kosdaq"):
        items = all_results.get(market_type, [])

        # 기존 데이터 삭제
        db.query(StockScreeningResult).filter(
            StockScreeningResult.market_type == market_type,
        ).delete(synchronize_session=False)

        # 새 결과 저장 (순번 부여)
        for rank, item in enumerate(items, 1):
            row = StockScreeningResult(
                market_type=market_type,
                rank=rank,
                stock_code=item["stock_code"],
                stock_name=item["stock_name"],
                current_price=item["current_price"],
                change_percent=item["change_percent"],
                volume=item["volume"],
                tenkan_sen=item["tenkan_sen"],
                kijun_sen=item["kijun_sen"],
                cloud_position=item["cloud_position"],
                is_new_high_120=item["is_new_high_120"],
                matched_conditions=item["matched_conditions"],
                screening_date=screening_date,
                collected_at=collected_at,
            )
            db.add(row)

        totals[market_type] = len(items)
        print(f"[조건검색] {market_type.upper()} → {len(items)}개 저장")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[조건검색] DB 저장 오류: {e}")
        raise

    print(f"[조건검색] 스크리닝 완료: 코스피 {totals.get('kospi', 0)}건, 코스닥 {totals.get('kosdaq', 0)}건")
    return totals


def get_latest_screening_results(db: Session, market_type: str, limit: int = 50) -> Dict:
    """
    최신 스크리닝 결과 조회.
    Returns: {"data": [...], "screening_date": "YYYY-MM-DD", "count": N}
    """
    # 최신 collected_at 조회
    latest_at = (
        db.query(func.max(StockScreeningResult.collected_at))
        .filter(StockScreeningResult.market_type == market_type)
        .scalar()
    )
    if not latest_at:
        return {"data": [], "screening_date": None, "count": 0}

    rows = (
        db.query(StockScreeningResult)
        .filter(
            StockScreeningResult.market_type == market_type,
            StockScreeningResult.collected_at == latest_at,
        )
        .order_by(StockScreeningResult.rank)
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
            "tenkan_sen": r.tenkan_sen,
            "kijun_sen": r.kijun_sen,
            "cloud_position": r.cloud_position,
            "is_new_high_120": r.is_new_high_120,
            "matched_conditions": r.matched_conditions,
            "screening_date": r.screening_date,
        }
        for r in rows
    ]
    screening_date = rows[0].screening_date if rows else None
    return {"data": data, "screening_date": screening_date, "count": len(data)}
