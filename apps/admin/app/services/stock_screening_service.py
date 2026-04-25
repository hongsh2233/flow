"""
기술적 지표 기반 조건검색 서비스 (익일 매수 후보 스크리닝)

FinanceDataReader를 사용하여 시총 상위 500종목을 분석합니다.
일목균형표는 pandas로 직접 계산 (외부 TA 라이브러리 불필요).
평일 20:30 KST 1회 실행.

스크리닝 조건:
  A: 2봉전 종가 > 전환선 (추세 유지)
  B/C/D: 현재가 또는 저가가 전환선 1% 이내 근접 (지지선 터치)
  E/F: 종가 > 선행스팬1 AND 종가 > 선행스팬2 (구름대 위)
  G: 양봉 (종가 > 시가)
  J: 최근 20봉 내 120봉 신고가 존재 (강한 추세)
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pytz

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.engine.models import StockScreeningResult
from app.services.screening_progress import update_progress, reset_progress

KST = pytz.timezone("Asia/Seoul")
# screening_date(YYYY-MM-DD) 기준 이 일수보다 오래된 행은 저장 시 삭제
SCREENING_DB_RETENTION_DAYS = 30


def _ichimoku(high, low, close, tenkan=9, kijun=26, senkou_b=52):
    """
    일목균형표를 pandas만으로 직접 계산한다.
    Returns: (tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b)
    """
    # 전환선 (Tenkan-sen): (9일 최고 + 9일 최저) / 2
    tenkan_sen = (high.rolling(window=tenkan).max() + low.rolling(window=tenkan).min()) / 2
    # 기준선 (Kijun-sen): (26일 최고 + 26일 최저) / 2
    kijun_sen = (high.rolling(window=kijun).max() + low.rolling(window=kijun).min()) / 2
    # 선행스팬 A (Senkou Span A): (전환선 + 기준선) / 2, 26일 앞으로 이동
    senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(kijun)
    # 선행스팬 B (Senkou Span B): (52일 최고 + 52일 최저) / 2, 26일 앞으로 이동
    senkou_span_b = ((high.rolling(window=senkou_b).max() + low.rolling(window=senkou_b).min()) / 2).shift(kijun)
    return tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b


def analyze_ichimoku_dataframe(df, symbol: str, name: str) -> Optional[Dict]:
    """
    일목·동일 조건검색 알고리즘 (admin/stock-screening과 동일).
    df: pandas DataFrame, 컬럼 Open, High, Low, Close, Volume (250봉 이상 권장).
    """
    import pandas as pd

    if df is None or len(df) < 250:
        return None

    df = df.copy()
    if "Date" in df.columns:
        df = df.sort_values("Date").reset_index(drop=True)
    else:
        try:
            df = df.sort_index()
        except TypeError:
            df = df.reset_index(drop=True)

    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col not in df.columns:
            return None
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    df = df.sort_index()
    if len(df) < 250:
        return None

    # --- 일목균형표 계산 (9, 26, 52) ---
    tenkan_sen, kijun_sen, span_a, span_b = _ichimoku(df["High"], df["Low"], df["Close"])
    df["tenkan_sen"] = tenkan_sen
    df["kijun_sen"] = kijun_sen
    df["span1"] = span_a
    df["span2"] = span_b

    df["high_120"] = df["High"].rolling(window=120).max()

    df = df.dropna(subset=["tenkan_sen", "kijun_sen", "span1", "span2", "high_120"])
    df = df.reset_index(drop=True)
    if len(df) < 3:
        return None

    curr = df.iloc[-1]
    prev2 = df.iloc[-3]

    matched = []

    if prev2["Close"] > prev2["tenkan_sen"]:
        matched.append("A")

    limit = curr["tenkan_sen"] * 0.01
    if (abs(curr["Close"] - curr["tenkan_sen"]) <= limit) or (
        abs(curr["Low"] - curr["tenkan_sen"]) <= limit
    ):
        matched.append("B")

    if curr["Close"] > curr["span1"] and curr["Close"] > curr["span2"]:
        matched.append("E")

    if curr["Close"] > curr["Open"]:
        matched.append("G")

    current_high_120 = df["high_120"].iloc[-1]
    recent_highs = df["High"].iloc[-20:]
    if current_high_120 > 0 and recent_highs.max() >= current_high_120:
        matched.append("J")

    required = {"A", "B", "E", "G", "J"}
    if not required.issubset(set(matched)):
        return None

    if len(df) >= 2:
        prev_close = df.iloc[-2]["Close"]
        change_pct = (
            ((curr["Close"] - prev_close) / prev_close * 100) if prev_close > 0 else 0
        )
    else:
        change_pct = 0

    vol = curr["Volume"]
    vol_s = str(int(vol)) if pd.notna(vol) else ""

    return {
        "stock_code": symbol,
        "stock_name": name,
        "current_price": str(int(curr["Close"])),
        "change_percent": f"{change_pct:+.2f}%",
        "volume": vol_s,
        "tenkan_sen": str(int(curr["tenkan_sen"])),
        "kijun_sen": str(int(curr["kijun_sen"])),
        "cloud_position": "above",
        "is_new_high_120": "J" in matched,
        "matched_conditions": ",".join(matched),
    }


def _analyze_stock(symbol: str, name: str) -> Optional[Dict]:
    """
    개별 종목에 대해 기술적 조건을 판정한다 (FinanceDataReader 일봉).
    """
    from app.services.screening_price_source import warn_if_kiwoom_pending

    warn_if_kiwoom_pending()
    import FinanceDataReader as fdr

    try:
        df = fdr.DataReader(symbol)
    except Exception:
        return None

    if df is None or len(df) < 250:
        return None

    return analyze_ichimoku_dataframe(df, symbol, name)


def list_top_symbols_by_market_cap(market: str, top_n: int = 500):
    """
    시총 상위 (코드 6자리, 종목명) 튜플 리스트. FDR StockListing 사용.
    market: kospi | kosdaq
    """
    try:
        import FinanceDataReader as fdr
    except ImportError as e:
        raise ImportError(
            "FinanceDataReader 패키지가 없습니다. admin 폴더에서 "
            "`pip install finance-datareader` 또는 `pip install -r requirements.txt` "
            "를 실행하세요."
        ) from e

    listing_name = "KOSPI" if market == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception as e:
        print(f"[조건검색] {listing_name} 종목 리스트 조회 실패: {e}")
        return []

    marcap_col = None
    for candidate in ["Marcap", "MarketCap", "marcap", "marketcap"]:
        if candidate in listing.columns:
            marcap_col = candidate
            break
    if marcap_col:
        listing = listing.sort_values(marcap_col, ascending=False)
    else:
        print(f"[조건검색] 경고: {listing_name} 시총 컬럼 없음. 컬럼: {listing.columns.tolist()}")
    listing = listing.head(top_n)

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
        print(f"[조건검색] {listing_name} 종목 리스트 컬럼을 찾을 수 없습니다.")
        return []

    out = []
    for _, row in listing.iterrows():
        symbol = str(row[code_col]).strip()
        name = str(row[name_col]).strip()
        if symbol and len(symbol) == 6 and symbol.isdigit():
            out.append((symbol, name))
    return out


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
    marcap_col = None
    for candidate in ["Marcap", "MarketCap", "marcap", "marketcap"]:
        if candidate in listing.columns:
            marcap_col = candidate
            break
    if marcap_col:
        listing = listing.sort_values(marcap_col, ascending=False)
    else:
        print(f"[조건검색] 경고: {listing_name} 시총 컬럼 없음 - 시총 정렬 불가. 컬럼: {listing.columns.tolist()}")
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
    update_progress("ichimoku", phase=f"종목 분석 ({market.upper()})", current=0, total=total,
                    message=f"{market.upper()} {total}개 종목 분석 시작")

    for idx, (_, row) in enumerate(listing.iterrows(), 1):
        symbol = str(row[code_col]).strip()
        name = str(row[name_col]).strip()

        if not symbol or len(symbol) != 6:
            continue

        try:
            result = _analyze_stock(symbol, name)
            if result:
                results.append(result)
        except Exception:
            pass  # 개별 종목 오류는 skip

        if idx % 50 == 0 or idx == total:
            update_progress("ichimoku", phase=f"종목 분석 ({market.upper()})",
                            current=idx, total=total,
                            message=f"{market.upper()} {idx}/{total} 분석 중 ({len(results)}건 발견)")
            if idx % 100 == 0:
                print(f"[조건검색] {market.upper()} {idx}/{total} 진행중... ({len(results)}건 발견)")

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
    동일 기준일(screening_date)·시장에 대한 행만 덮어쓰고, 과거 일자 스냅샷은 유지한다.
    """
    now_kst = datetime.now(KST)
    screening_date = now_kst.strftime("%Y-%m-%d")
    collected_at = now_kst.replace(second=0, microsecond=0)

    print(f"[조건검색] 스크리닝 시작 ({screening_date}, 시총 상위 {top_n}종목)")
    reset_progress("ichimoku")

    all_results = await scan_all_stocks(top_n=top_n)
    totals: Dict[str, int] = {}

    try:
        cutoff_str = (now_kst.date() - timedelta(days=SCREENING_DB_RETENTION_DAYS)).strftime("%Y-%m-%d")
        deleted_old = (
            db.query(StockScreeningResult)
            .filter(StockScreeningResult.screening_date < cutoff_str)
            .delete(synchronize_session=False)
        )
        if deleted_old:
            print(
                f"[조건검색] 기준일 {cutoff_str} 미만(보관 {SCREENING_DB_RETENTION_DAYS}일) {deleted_old}건 삭제 예정"
            )
    except Exception as e:
        print(f"[조건검색] 오래된 스크리닝 행 정리 실패(이번 저장은 계속): {e}")

    for market_type in ("kospi", "kosdaq"):
        items = all_results.get(market_type, [])

        # 해당 시장·기준일만 삭제 (과거 일자 이력 유지)
        db.query(StockScreeningResult).filter(
            StockScreeningResult.market_type == market_type,
            StockScreeningResult.screening_date == screening_date,
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
        update_progress("ichimoku", status="error", phase="오류", message=f"DB 저장 오류: {e}")
        raise

    msg = f"완료: 코스피 {totals.get('kospi', 0)}건, 코스닥 {totals.get('kosdaq', 0)}건"
    print(f"[조건검색] 스크리닝 {msg}")
    update_progress("ichimoku", status="completed", phase="완료", current=1, total=1, message=msg)
    return totals


def list_stock_screening_dates(db: Session, market_type: str, limit: int = 120) -> List[str]:
    """저장된 기준일 목록 (최신순). BO에서 일자 선택용."""
    rows = (
        db.query(StockScreeningResult.screening_date)
        .filter(StockScreeningResult.market_type == market_type)
        .distinct()
        .order_by(StockScreeningResult.screening_date.desc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows if r[0]]


def get_latest_screening_results(
    db: Session,
    market_type: str,
    limit: int = 50,
    screening_date: Optional[str] = None,
) -> Dict:
    """
    스크리닝 결과 조회.
    screening_date가 None이면 최신 수집분(collected_at 기준) 1회분만 반환 (앱 사용자용).
    screening_date가 지정되면 해당 기준일 스냅샷만 반환 (BO 이력 조회용).
    Returns: {"data": [...], "screening_date": "YYYY-MM-DD", "count": N}
    """
    if screening_date:
        rows = (
            db.query(StockScreeningResult)
            .filter(
                StockScreeningResult.market_type == market_type,
                StockScreeningResult.screening_date == screening_date,
            )
            .order_by(StockScreeningResult.rank)
            .limit(limit)
            .all()
        )
        if not rows:
            return {"data": [], "screening_date": screening_date, "count": 0}
    else:
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
