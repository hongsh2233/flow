"""
Yahoo Finance 지수 수집/저장 서비스

요구사항:
- 미국증시 지수: 매일 06:20 / 24:00 / 02:00 / 04:00 (KST) 스케줄로 수집, 기존 데이터 덮어쓰기
- 한국증시 지수(코스피/코스닥): 09:20 / 11:00 / 13:00 / 15:30 (KST) 수집, 날짜별 마지막 값 저장
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
]

DEFAULT_KR_INDICES: list[YahooIndexDef] = [
    YahooIndexDef(group="kr", symbol="^KS11", name="코스피", market="KR"),
    YahooIndexDef(group="kr", symbol="^KQ11", name="코스닥", market="KR"),
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


async def _fetch_one_index(client: httpx.AsyncClient, idx: YahooIndexDef) -> dict:
    """
    Yahoo Finance v8 chart API에서 지수 1건 조회 후 표준 dict 반환
    """
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{idx.symbol}"
        params = {"interval": "1d", "range": "5d"}
        res = await client.get(url, params=params, timeout=10.0)
        if res.status_code >= 400:
            return {
                "ok": False,
                "group": idx.group,
                "symbol": idx.symbol,
                "name": idx.name,
                "market": idx.market,
                "error": f"http_{res.status_code}",
            }

        data = res.json()

        chart = data.get("chart") or {}
        if chart.get("error"):
            return {
                "ok": False,
                "group": idx.group,
                "symbol": idx.symbol,
                "name": idx.name,
                "market": idx.market,
                "error": f"chart_error: {chart.get('error')}",
            }
        if not chart.get("result"):
            return {
                "ok": False,
                "group": idx.group,
                "symbol": idx.symbol,
                "name": idx.name,
                "market": idx.market,
                "error": "no_result",
            }

        result = chart["result"][0]
        meta = result.get("meta", {}) or {}
        quote = (result.get("indicators") or {}).get("quote") or [{}]
        close = (quote[0] or {}).get("close") or []

        # 가장 신뢰할 수 있는 값: regularMarketPrice / previousClose
        price = meta.get("regularMarketPrice") or meta.get("chartPreviousClose") or meta.get("previousClose")
        prev = meta.get("previousClose") or meta.get("chartPreviousClose") or price
        if price is None:
            price = _last_non_null(close)
        if prev is None:
            prev = _prev_non_null(close) or price
        if price is None or prev is None:
            return {
                "ok": False,
                "group": idx.group,
                "symbol": idx.symbol,
                "name": idx.name,
                "market": idx.market,
                "error": "no_price",
            }

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
        return {
            "ok": False,
            "group": idx.group,
            "symbol": idx.symbol,
            "name": idx.name,
            "market": idx.market,
            "error": f"exception: {type(e).__name__}: {str(e)}",
        }


async def fetch_indices(indices: Iterable[YahooIndexDef]) -> list[dict]:
    async with httpx.AsyncClient(
        headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        },
        follow_redirects=True,
    ) as client:
        tasks = [_fetch_one_index(client, idx) for idx in indices]
        results = await asyncio.gather(*tasks)
    return list(results)


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


