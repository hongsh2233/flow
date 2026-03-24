"""
Yahoo Finance 지수 수집/저장 서비스

요구사항:
- 미국증시 지수: 매일 06:20 / 24:00 / 02:00 / 04:00 (KST) 스케줄로 수집, 기존 데이터 덮어쓰기
- 한국증시 지수(코스피/코스닥 등): 장중 30분 간격 + 15:40 장마감 등은 scheduler_service.YahooIndexScheduler 와 동일
- 최대 7일 데이터만 유지 (8일째가 되면 1일차 삭제)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, date as date_type
from typing import Optional, Iterable, Any

import asyncio
import httpx
import pytz
from sqlalchemy.orm import Session

from app import models


KST = pytz.timezone("Asia/Seoul")

# api.py의 _YAHOO_HEADERS와 동일하게 유지 (Windows Chrome UA - 검증된 동작)
_YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


@dataclass(frozen=True)
class YahooIndexDef:
    group: str
    symbol: str
    name: str
    market: Optional[str] = None


DEFAULT_US_INDICES: list[YahooIndexDef] = [
    YahooIndexDef(group="us", symbol="^GSPC", name="S&P 500", market="US"),
    YahooIndexDef(group="us", symbol="^DJI", name="다우존스", market="US"),
    YahooIndexDef(group="us", symbol="^IXIC", name="나스닥", market="US"),
    YahooIndexDef(group="us", symbol="^SOX", name="필라델피아 반도체", market="US"),
]

DEFAULT_KR_INDICES: list[YahooIndexDef] = [
    YahooIndexDef(group="kr", symbol="^KS11", name="코스피", market="KR"),
    YahooIndexDef(group="kr", symbol="^KQ11", name="코스닥", market="KR"),
    YahooIndexDef(group="kr", symbol="^KS200", name="코스피 200", market="KR"),
]

# 아침 시장 요약 — collect_market_morning_summary 가 06:35 KST 에 수집 (뉴욕 마감, 선물, 코스피200 등)
MORNING_SUMMARY_INDICES: list[YahooIndexDef] = [
    YahooIndexDef(group="morning", symbol="^IXIC", name="나스닥", market="US"),
    YahooIndexDef(group="morning", symbol="^GSPC", name="S&P 500", market="US"),
    YahooIndexDef(group="morning", symbol="^DJI", name="다우존스", market="US"),
    YahooIndexDef(group="morning", symbol="^SOX", name="필라델피아 반도체", market="US"),
    YahooIndexDef(group="morning", symbol="NQ=F", name="나스닥 선물", market="US"),
    YahooIndexDef(group="morning", symbol="^KS200", name="코스피 200", market="KR"),
    YahooIndexDef(group="morning", symbol="^MSKR", name="MSCI Korea", market="KR"),
    YahooIndexDef(group="morning", symbol="EWY", name="iShares MSCI Korea ETF", market="US"),
    YahooIndexDef(group="morning", symbol="^KS11", name="코스피", market="KR"),
    YahooIndexDef(group="morning", symbol="^KQ11", name="코스닥", market="KR"),
]

# 메인 페이지 해외지수 (00:00, 05:00, 06:30 KST 수집) - 미국지수(나스닥/S&P500/다우존스) 우선
DEFAULT_FOREIGN_INDICES: list[YahooIndexDef] = [
    YahooIndexDef(group="foreign", symbol="^IXIC", name="나스닥", market="US"),
    YahooIndexDef(group="foreign", symbol="^GSPC", name="S&P 500", market="US"),
    YahooIndexDef(group="foreign", symbol="^DJI", name="다우존스", market="US"),
    YahooIndexDef(group="foreign", symbol="^SOX", name="필라델피아 반도체", market="US"),
    YahooIndexDef(group="foreign", symbol="^KS11", name="코스피", market="KR"),
    YahooIndexDef(group="foreign", symbol="^KQ11", name="코스닥", market="KR"),
    YahooIndexDef(group="foreign", symbol="^KS200", name="코스피 200", market="KR"),
    YahooIndexDef(group="foreign", symbol="^MSKR", name="MSCI Korea", market="KR"),
    YahooIndexDef(group="foreign", symbol="EWY", name="iShares MSCI Korea ETF", market="US"),
    YahooIndexDef(group="foreign", symbol="^N225", name="닛케이", market="JP"),
    YahooIndexDef(group="foreign", symbol="^HSI", name="항셍", market="HK"),
    YahooIndexDef(group="foreign", symbol="000001.SS", name="상하이종합", market="CN"),
    YahooIndexDef(group="foreign", symbol="^STOXX50E", name="유로스톡스50", market="EU"),
    YahooIndexDef(group="foreign", symbol="^FTSE", name="FTSE 100", market="UK"),
    YahooIndexDef(group="foreign", symbol="^GDAXI", name="DAX", market="DE"),
    YahooIndexDef(group="foreign", symbol="^FCHI", name="CAC 40", market="FR"),
    YahooIndexDef(group="foreign", symbol="^RUT", name="러셀2000", market="US"),
    YahooIndexDef(group="foreign", symbol="^VIX", name="VIX", market="US"),
]


def _kst_now() -> datetime:
    return datetime.now(KST)


def _to_kst_date(dt: datetime) -> date_type:
    if dt.tzinfo is None:
        dt = KST.localize(dt)
    return dt.astimezone(KST).date()


def _hhmm(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = KST.localize(dt)
    dt = dt.astimezone(KST)
    return f"{dt.hour:02d}:{dt.minute:02d}"


def _last_non_null(values: list[Any]) -> Any:
    if not values:
        return None
    for v in reversed(values):
        if v is not None:
            return v
    return None


def _prev_non_null(values: list[Any]) -> Any:
    """
    마지막 값의 직전 non-null 값을 찾음 (변동 계산용).
    """
    if not values:
        return None
    seen_last = False
    for v in reversed(values):
        if v is None:
            continue
        if not seen_last:
            seen_last = True
            continue
        return v
    return None


# =========================================================
# Yahoo Finance crumb 인증
# =========================================================

_crumb_cache: dict = {"crumb": None, "cookies": None, "expires": 0}
_CRUMB_TTL = 1800  # 30분


async def _get_yahoo_crumb(client: httpx.AsyncClient) -> tuple[Optional[str], Optional[httpx.Cookies]]:
    """
    Yahoo Finance crumb + 세션 쿠키 획득.
    Yahoo v8 API는 crumb 인증이 필요한 심볼이 있음 (^GSPC, ^KS11 등).

    Flow:
    1. GET https://fc.yahoo.com → 세션 쿠키 획득
    2. GET https://query2.finance.yahoo.com/v1/test/getcrumb → crumb 문자열 획득
    """
    import time

    # 캐시된 crumb가 유효하면 재사용
    if _crumb_cache["crumb"] and _crumb_cache["expires"] > time.time():
        return _crumb_cache["crumb"], _crumb_cache["cookies"]

    try:
        # 1단계: 세션 쿠키 획득
        r1 = await client.get(
            "https://fc.yahoo.com",
            headers=_YAHOO_HEADERS,
            timeout=10.0,
            follow_redirects=True,
        )
        cookies = r1.cookies

        # 2단계: crumb 획득
        r2 = await client.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            headers=_YAHOO_HEADERS,
            cookies=cookies,
            timeout=10.0,
            follow_redirects=True,
        )

        if r2.status_code == 200:
            crumb = r2.text.strip()
            if crumb and len(crumb) < 100:
                _crumb_cache["crumb"] = crumb
                _crumb_cache["cookies"] = cookies
                _crumb_cache["expires"] = time.time() + _CRUMB_TTL
                print(f"✅ Yahoo crumb 획득 성공")
                return crumb, cookies

        print(f"⚠️ Yahoo crumb 획득 실패 (status={r2.status_code})")
        return None, None
    except Exception as e:
        print(f"⚠️ Yahoo crumb 획득 오류: {type(e).__name__}: {e}")
        return None, None


# =========================================================
# Yahoo Finance 지수 조회
# =========================================================

async def _fetch_one_index(
    client: httpx.AsyncClient,
    idx: YahooIndexDef,
    crumb: Optional[str] = None,
    cookies: Optional[httpx.Cookies] = None,
) -> dict:
    """
    Yahoo Finance chart API에서 지수 1건 조회 후 표준 dict 반환.
    query1 → query2 순서로 fallback 시도.
    """
    base_urls = [
        "https://query1.finance.yahoo.com/v8/finance/chart/",
        "https://query2.finance.yahoo.com/v8/finance/chart/",
    ]

    params = {"interval": "1d", "range": "5d"}
    if crumb:
        params["crumb"] = crumb

    last_error = "unknown"

    for base_url in base_urls:
        url = f"{base_url}{idx.symbol}"
        try:
            last_status = None
            res = None
            for attempt in range(3):
                kwargs = {
                    "url": url,
                    "params": params,
                    "headers": _YAHOO_HEADERS,
                    "timeout": 10.0,
                }
                if cookies:
                    kwargs["cookies"] = cookies

                res = await client.get(**kwargs)
                last_status = res.status_code

                if res.status_code == 429:
                    retry_after = res.headers.get("Retry-After")
                    try:
                        sleep_s = float(retry_after) if retry_after else (1.0 * (2 ** attempt))
                    except Exception:
                        sleep_s = (1.0 * (2 ** attempt))
                    sleep_s = min(10.0, sleep_s + (0.3 * attempt))
                    await asyncio.sleep(sleep_s)
                    continue

                if 500 <= res.status_code <= 599:
                    await asyncio.sleep(min(5.0, 0.5 * (2 ** attempt)))
                    continue

                break

            if last_status and last_status >= 400:
                last_error = f"http_{last_status}"
                continue  # 다음 base_url 시도

            data = res.json()
            chart = data.get("chart") or {}

            if chart.get("error"):
                last_error = f"chart_error: {chart.get('error')}"
                continue

            if not chart.get("result"):
                last_error = "no_result"
                continue

            result = chart["result"][0]
            meta = result.get("meta", {}) or {}
            quote = (result.get("indicators") or {}).get("quote") or [{}]
            close = (quote[0] or {}).get("close") or []

            # 변동 계산: close 배열 우선 사용 (최신 = 마지막, 직전 = 그 이전)
            # chartPreviousClose는 5일 전 값일 수 있어 부정확하므로, close 배열이 2개 이상이면 사용
            last_close = _last_non_null(close)
            prev_close = _prev_non_null(close)

            # Yahoo 메타의 시세·전일(또는 차트 기준 종가)을 우선: close 배열에 null 슬롯이 끼면
            # _prev_non_null 이 '진짜 전일'이 아닌 더 앞선 막대를 집어 등락 부호가 뒤집힐 수 있음 (^KS11 등).
            rm_price = meta.get("regularMarketPrice")
            baseline = (
                meta.get("regularMarketPreviousClose")
                or meta.get("previousClose")
                or meta.get("chartPreviousClose")
            )

            if rm_price is not None and baseline is not None:
                price = float(rm_price)
                prev = float(baseline)
            elif last_close is not None and prev_close is not None:
                price = float(last_close)
                prev = float(prev_close)
            else:
                price = meta.get("regularMarketPrice") or meta.get("previousClose") or meta.get("chartPreviousClose")
                prev = meta.get("previousClose") or meta.get("chartPreviousClose") or price
                if price is None:
                    price = last_close
                if prev is None:
                    prev = prev_close or price
                if price is not None:
                    price = float(price)
                if prev is not None:
                    prev = float(prev)

            if price is None or prev is None:
                last_error = "no_price"
                continue

            # change = 현재가(최신) - 직전종가 (하락 시 음수)
            change = float(price) - float(prev)
            change_percent = (change / float(prev) * 100.0) if float(prev) != 0 else 0.0

            return {
                "ok": True,
                "group": idx.group,
                "symbol": idx.symbol,
                "name": idx.name,
                "market": idx.market,
                "currency": meta.get("currency"),
                "price": float(price),
                "change": float(change),
                "change_percent": float(change_percent),
                "regular_market_time": meta.get("regularMarketTime"),
            }
        except Exception as e:
            last_error = f"exception: {type(e).__name__}: {str(e)}"
            continue

    # 모든 URL 시도 실패
    print(f"⚠️ Yahoo 지수 조회 실패: {idx.symbol} - {last_error}")
    return {
        "ok": False,
        "group": idx.group,
        "symbol": idx.symbol,
        "name": idx.name,
        "market": idx.market,
        "error": last_error,
    }


async def fetch_indices(indices: Iterable[YahooIndexDef]) -> list[dict]:
    """
    지수 목록을 순차적으로 조회 (rate limit 방지).
    crumb 인증을 사용하여 ^GSPC, ^KS11 등 인증 필요 심볼도 지원.
    """
    async with httpx.AsyncClient(follow_redirects=True) as client:
        # crumb 인증 토큰 획득
        crumb, cookies = await _get_yahoo_crumb(client)

        results = []
        for idx in indices:
            result = await _fetch_one_index(client, idx, crumb=crumb, cookies=cookies)
            results.append(result)
            # 순차 호출 사이 딜레이 (api.py와 동일 패턴, rate limit 방지)
            await asyncio.sleep(0.5)

    return results


def upsert_indices_to_db(
    db: Session,
    items: list[dict],
    collected_at: Optional[datetime] = None,
    keep_days: int = 7,
):
    """
    - snapshots: 매 수집마다 insert
    - daily: date+group+symbol 기준 upsert (마지막 값 저장)
    - retention: keep_days만 유지
    """
    if collected_at is None:
        collected_at = _kst_now()
    if collected_at.tzinfo is None:
        collected_at = KST.localize(collected_at)

    c_date = _to_kst_date(collected_at)
    c_time = _hhmm(collected_at)

    for it in items:
        # 실패/값없음은 저장하지 않음
        if not it or it.get("ok") is not True:
            continue
        if it.get("price") is None:
            continue

        snap = models.YahooIndexSnapshot(
            group=it["group"],
            symbol=it["symbol"],
            name=it["name"],
            market=it.get("market"),
            currency=it.get("currency"),
            price=it.get("price"),
            change=it.get("change"),
            change_percent=it.get("change_percent"),
            regular_market_time=it.get("regular_market_time"),
            collected_at=collected_at,
            collected_date=c_date,
            collected_time=c_time,
        )
        db.add(snap)

        # daily upsert
        existing = db.query(models.YahooIndexDaily).filter(
            models.YahooIndexDaily.date == c_date,
            models.YahooIndexDaily.group == it["group"],
            models.YahooIndexDaily.symbol == it["symbol"],
        ).first()
        if existing:
            existing.name = it["name"]
            existing.market = it.get("market")
            existing.currency = it.get("currency")
            existing.price = it.get("price")
            existing.change = it.get("change")
            existing.change_percent = it.get("change_percent")
            existing.last_collected_at = collected_at
            existing.last_collected_time = c_time
        else:
            db.add(models.YahooIndexDaily(
                date=c_date,
                group=it["group"],
                symbol=it["symbol"],
                name=it["name"],
                market=it.get("market"),
                currency=it.get("currency"),
                price=it.get("price"),
                change=it.get("change"),
                change_percent=it.get("change_percent"),
                last_collected_at=collected_at,
                last_collected_time=c_time,
            ))

    # retention: keep only last N days (delete older than today-(keep_days-1))
    cutoff = c_date - timedelta(days=keep_days - 1)
    db.query(models.YahooIndexDaily).filter(models.YahooIndexDaily.date < cutoff).delete(synchronize_session=False)
    db.query(models.YahooIndexSnapshot).filter(models.YahooIndexSnapshot.collected_date < cutoff).delete(synchronize_session=False)

    db.commit()
