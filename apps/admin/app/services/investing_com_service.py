"""
Investing.com 코스피200 선물 수집 서비스

- Yahoo Finance에서 제공하지 않는 코스피200 야간선물 데이터 수집
- Pair ID 8893: KOSPI 200 Futures (주간+야간 포함)
- 비공식 API 사용 (Cloudflare 차단 가능성 있음)
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import httpx
import pytz
from sqlalchemy.orm import Session

from app import models


KST = pytz.timezone("Asia/Seoul")

# KOSPI 200 Futures - Investing.com pair ID
KOSPI200_FUTURES_PAIR_ID = 8893

# 브라우저와 유사한 헤더 (Cloudflare 403 우회 시도)
_INVESTING_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.investing.com/indices/korea-200-futures",
    "Origin": "https://www.investing.com",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
}


def _kst_now() -> datetime:
    return datetime.now(KST)


def _to_kst_date(dt: datetime):
    if dt.tzinfo is None:
        dt = KST.localize(dt)
    return dt.astimezone(KST).date()


def _hhmm(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = KST.localize(dt)
    dt = dt.astimezone(KST)
    return f"{dt.hour:02d}:{dt.minute:02d}"


async def fetch_kospi200_futures() -> Optional[dict]:
    """
    Investing.com API에서 코스피200 선물(야간선물 포함) 데이터 조회.

    Returns:
        dict: {"ok": True, "symbol": "...", "name": "...", "price": float, "change": float, "change_percent": float, ...}
              또는 {"ok": False, "error": "..."}
    """
    # P1D=1일, interval=1d, pointscount=10 (최근 10일)
    url = f"https://api.investing.com/api/financialdata/{KOSPI200_FUTURES_PAIR_ID}/historical/chart"
    params = {
        "period": "P1W",  # 1주 데이터
        "interval": "1d",
        "pointscount": "10",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            res = await client.get(url, params=params, headers=_INVESTING_HEADERS)
            if res.status_code != 200:
                return {"ok": False, "error": f"http_{res.status_code}"}

            data = res.json()
            # 응답 형식: [...], 또는 {"data": [...]}, {"@errors": [...]}
            if isinstance(data, dict):
                if "@errors" in data:
                    return {"ok": False, "error": str(data.get("@errors", "api_error"))}
                data = data.get("data") or data.get("chart") or []
            if not isinstance(data, list) or len(data) < 2:
                return {"ok": False, "error": "no_data"}

            # 최신 = 마지막, 직전 = 그 이전
            latest = data[-1]
            prev = data[-2]

            price_close = latest.get("price_close") or latest.get("priceClose")
            prev_close = (prev.get("price_close") or prev.get("priceClose") or
                         prev.get("price_open") or prev.get("priceOpen"))

            price = None
            if price_close is not None:
                price = float(price_close)
            elif latest.get("price_open") or latest.get("priceOpen"):
                price = float(latest.get("price_open") or latest.get("priceOpen"))

            if price is None:
                return {"ok": False, "error": "no_price"}

            prev_val = None
            if prev_close is not None:
                prev_val = float(prev_close)

            if prev_val is None or prev_val == 0:
                change = 0.0
                change_percent = 0.0
            else:
                change = price - prev_val
                change_percent = (change / prev_val) * 100.0

            return {
                "ok": True,
                "group": "morning",
                "symbol": "INV:8893",
                "name": "코스피200 야간선물",
                "market": "KR",
                "currency": "KRW",
                "price": float(price),
                "change": float(change),
                "change_percent": float(change_percent),
                "regular_market_time": latest.get("date"),
            }
        except Exception as e:
            return {"ok": False, "error": f"{type(e).__name__}: {str(e)}"}


def upsert_kospi200_futures_to_db(
    db: Session,
    item: dict,
    collected_at: Optional[datetime] = None,
):
    """
    코스피200 야간선물 데이터를 YahooIndexSnapshot/Daily와 동일한 테이블에 저장.
    group='morning', symbol='INV:8893' 로 구분.
    """
    if not item or item.get("ok") is not True or item.get("price") is None:
        return

    if collected_at is None:
        collected_at = _kst_now()
    if collected_at.tzinfo is None:
        collected_at = KST.localize(collected_at)

    c_date = _to_kst_date(collected_at)
    c_time = _hhmm(collected_at)

    snap = models.YahooIndexSnapshot(
        group=item["group"],
        symbol=item["symbol"],
        name=item["name"],
        market=item.get("market"),
        currency=item.get("currency"),
        price=item.get("price"),
        change=item.get("change"),
        change_percent=item.get("change_percent"),
        regular_market_time=item.get("regular_market_time"),
        collected_at=collected_at,
        collected_date=c_date,
        collected_time=c_time,
    )
    db.add(snap)

    existing = db.query(models.YahooIndexDaily).filter(
        models.YahooIndexDaily.date == c_date,
        models.YahooIndexDaily.group == item["group"],
        models.YahooIndexDaily.symbol == item["symbol"],
    ).first()
    if existing:
        existing.name = item["name"]
        existing.market = item.get("market")
        existing.currency = item.get("currency")
        existing.price = item["price"]
        existing.change = item.get("change")
        existing.change_percent = item.get("change_percent")
        existing.last_collected_at = collected_at
        existing.last_collected_time = c_time
    else:
        db.add(models.YahooIndexDaily(
            date=c_date,
            group=item["group"],
            symbol=item["symbol"],
            name=item["name"],
            market=item.get("market"),
            currency=item.get("currency"),
            price=item["price"],
            change=item.get("change"),
            change_percent=item.get("change_percent"),
            last_collected_at=collected_at,
            last_collected_time=c_time,
        ))

    # retention은 Yahoo 지수 수집 시 함께 처리됨 (keep_days)
    db.commit()
