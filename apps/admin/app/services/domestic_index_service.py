"""
국내 지수(코스피/코스닥): 네이버 모바일 API 조회 → domestic_index_snapshots 저장.
웹 API와 장마감 시황이 동일 DB 배치를 쓰도록 한다.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
import pytz
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.engine.models import DomesticIndexSnapshot

KST = pytz.timezone("Asia/Seoul")

NAVER_DOMESTIC_ITEMS = [
    {"name": "코스피", "code": "KOSPI"},
    {"name": "코스닥", "code": "KOSDAQ"},
]

# 메인 API 캐시 TTL과 맞춤 (초)
DEFAULT_STALE_SECONDS = 300

# 스냅샷 보관 일수 (collected_date 기준 이보다 오래된 행 삭제)
KEEP_DAYS = 5


def _parse_naver_basic_json(data: dict, item: dict) -> Optional[dict]:
    try:
        close_price = str(data.get("closePrice", "0")).replace(",", "")
        change_val = str(data.get("compareToPreviousClosePrice", "0")).replace(",", "")
        pct_val = str(data.get("fluctuationsRatio", "0")).replace(",", "")
        compare = data.get("compareToPreviousPrice") or {}
        compare_code = compare.get("code", "3") if isinstance(compare, dict) else "3"

        sign = ""
        if compare_code == "2":
            sign = "+"
        elif compare_code == "5":
            sign = "-"

        price_f = float(close_price or 0)
        raw_change = float(change_val or 0)
        raw_pct = float(pct_val or 0)
        if compare_code == "5":
            raw_change = -abs(raw_change)
            raw_pct = -abs(raw_pct)
        elif compare_code == "2":
            raw_change = abs(raw_change)
            raw_pct = abs(raw_pct)

        return {
            "name": item["name"],
            "code": item["code"],
            "value": data.get("closePrice", "0"),
            "change": f"{sign}{change_val}",
            "percent": f"{sign}{pct_val}%",
            "price": price_f,
            "change_num": raw_change,
            "change_percent": raw_pct,
            "local_traded_at": data.get("localTradedAt") or "",
        }
    except (TypeError, ValueError):
        return None


def _fetch_naver_one_sync(client: httpx.Client, item: dict) -> Optional[dict]:
    try:
        url = f"https://m.stock.naver.com/api/index/{item['code']}/basic"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        res = client.get(url, headers=headers, timeout=5.0)
        if res.status_code == 200:
            return _parse_naver_basic_json(res.json(), item)
    except Exception as e:
        print(f"Naver Index Fetch Error for {item['code']}: {e}")
    return None


async def _fetch_naver_one_async(client: httpx.AsyncClient, item: dict) -> Optional[dict]:
    try:
        url = f"https://m.stock.naver.com/api/index/{item['code']}/basic"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        res = await client.get(url, headers=headers, timeout=5.0)
        if res.status_code == 200:
            return _parse_naver_basic_json(res.json(), item)
    except Exception as e:
        print(f"Naver Index Fetch Error for {item['code']}: {e}")
    return None


def _api_timestamp_from_rows(rows: List[dict]) -> str:
    ts_values = [r["local_traded_at"] for r in rows if r.get("local_traded_at")]
    if not ts_values:
        return ""
    latest_ts = max(ts_values)
    try:
        dt = datetime.fromisoformat(latest_ts)
        if dt.tzinfo is None:
            dt = KST.localize(dt)
        else:
            dt = dt.astimezone(KST)
        return dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return latest_ts


def parsed_rows_to_api_payload(parsed: List[dict]) -> Dict[str, Any]:
    out = []
    for r in parsed:
        out.append(
            {
                "name": r["name"],
                "value": r["value"],
                "change": r["change"],
                "percent": r["percent"],
            }
        )
    timestamp = _api_timestamp_from_rows(parsed)
    return {
        "success": bool(out),
        "data": out,
        "timestamp": timestamp,
    }


def persist_domestic_snapshot_batch(db: Session, parsed: List[dict]) -> None:
    if not parsed:
        return
    now = datetime.now(KST)
    collected_at = now
    collected_date = now.date()
    collected_time = now.strftime("%H:%M")
    for r in parsed:
        db.add(
            DomesticIndexSnapshot(
                index_code=r["code"],
                name=r["name"],
                price=r["price"],
                change=r["change_num"],
                change_percent=r["change_percent"],
                local_traded_at=r.get("local_traded_at") or None,
                collected_at=collected_at,
                collected_date=collected_date,
                collected_time=collected_time,
            )
        )
    db.commit()
    cutoff = collected_date
    old = cutoff - timedelta(days=KEEP_DAYS)
    db.query(DomesticIndexSnapshot).filter(DomesticIndexSnapshot.collected_date < old).delete(
        synchronize_session=False
    )
    db.commit()


def fetch_and_persist_domestic_indices_sync(db: Session) -> Optional[Dict[str, Any]]:
    """동기: 네이버 조회 후 DB 저장. API 페이로드 형태로 반환."""
    results: List[dict] = []
    with httpx.Client(follow_redirects=True) as client:
        for item in NAVER_DOMESTIC_ITEMS:
            row = _fetch_naver_one_sync(client, item)
            if row:
                results.append(row)
    if not results:
        return None
    persist_domestic_snapshot_batch(db, results)
    return parsed_rows_to_api_payload(results)


async def fetch_and_persist_domestic_indices_async(db: Session) -> Optional[Dict[str, Any]]:
    results: List[dict] = []
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for item in NAVER_DOMESTIC_ITEMS:
            row = await _fetch_naver_one_async(client, item)
            if row:
                results.append(row)
    if not results:
        return None
    persist_domestic_snapshot_batch(db, results)
    return parsed_rows_to_api_payload(results)


def _row_model_to_display(r: DomesticIndexSnapshot) -> dict:
    c = r.change or 0.0
    p = r.change_percent or 0.0
    sign_c = "+" if c > 0 else ("-" if c < 0 else "")
    sign_p = "+" if p > 0 else ("-" if p < 0 else "")
    if r.price is None:
        value = "0"
    else:
        value = f"{r.price:,.2f}"
    ch_str = "0" if c == 0 else f"{sign_c}{abs(c):.2f}"
    pct_str = "0%" if p == 0 else f"{sign_p}{abs(p):.2f}%"
    return {"name": r.name, "value": value, "change": ch_str, "percent": pct_str}


def load_latest_domestic_api_payload_from_db(
    db: Session,
    kst_date: date,
    max_age_seconds: float = DEFAULT_STALE_SECONDS,
) -> Optional[Dict[str, Any]]:
    """당일 최신 배치가 max_age 이내면 API와 동일 형태로 반환."""
    codes = ["KOSPI", "KOSDAQ"]
    rows = _rows_latest_domestic_batch(db, kst_date, codes)
    if len(rows) < 2:
        return None
    latest_at = rows[0].collected_at
    if not latest_at:
        return None
    now = datetime.now(KST)
    if latest_at.tzinfo is None:
        latest_at = KST.localize(latest_at)
    else:
        latest_at = latest_at.astimezone(KST)
    if (now - latest_at).total_seconds() > max_age_seconds:
        return None
    by_code = {r.index_code: r for r in rows}
    ordered: List[DomesticIndexSnapshot] = []
    for c in codes:
        if c not in by_code:
            return None
        ordered.append(by_code[c])
    data = [_row_model_to_display(r) for r in ordered]
    ts_values = [r.local_traded_at for r in ordered if r.local_traded_at]
    timestamp = ""
    if ts_values:
        timestamp = _api_timestamp_from_rows(
            [{"local_traded_at": t} for t in ts_values if t]
        )
    if not timestamp and latest_at:
        timestamp = latest_at.strftime("%Y-%m-%d %H:%M")
    return {"success": True, "data": data, "timestamp": timestamp}


CODE_TO_YAHOO_SYMBOL = {"KOSPI": "^KS11", "KOSDAQ": "^KQ11"}


def _rows_latest_domestic_batch(
    db: Session, collected_date: date, index_codes: List[str]
) -> List[DomesticIndexSnapshot]:
    """해당 일자·코드들에 대해 max(collected_at)인 배치의 행만 조회 (Python 쪽 datetime 동등 비교 이슈 회피)."""
    max_at_subq = (
        select(func.max(DomesticIndexSnapshot.collected_at))
        .where(
            DomesticIndexSnapshot.collected_date == collected_date,
            DomesticIndexSnapshot.index_code.in_(index_codes),
        )
        .scalar_subquery()
    )
    return list(
        db.scalars(
            select(DomesticIndexSnapshot).where(
                DomesticIndexSnapshot.collected_date == collected_date,
                DomesticIndexSnapshot.index_code.in_(index_codes),
                DomesticIndexSnapshot.collected_at == max_at_subq,
            )
        ).all()
    )


def get_kr_indices_dicts_from_domestic_db(db: Session, target_date: date) -> List[dict]:
    """장마감용: target_date(KST)의 네이버 국내지수 최신 배치 → Gemini 파이프라인 dict."""
    codes = ["KOSPI", "KOSDAQ"]
    rows = _rows_latest_domestic_batch(db, target_date, codes)
    if len(rows) < 2:
        return []
    by_code = {r.index_code: r for r in rows}
    out: List[dict] = []
    for code in codes:
        r = by_code.get(code)
        if not r or r.price is None or r.change is None or r.change_percent is None:
            continue
        sym = CODE_TO_YAHOO_SYMBOL.get(code)
        if not sym:
            continue
        out.append(
            {
                "name": r.name,
                "symbol": sym,
                "price": round(float(r.price), 2),
                "change": round(float(r.change), 2),
                "change_percent": round(float(r.change_percent), 2),
            }
        )
    return sorted(out, key=lambda x: (0 if x["symbol"] == "^KS11" else 1))
