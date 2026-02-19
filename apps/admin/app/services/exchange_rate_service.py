"""
환율 수집 서비스 - Yahoo Finance에서 30분마다 수집하여 DB 저장
"""
import httpx
import pytz
from datetime import datetime, date
from sqlalchemy.orm import Session

from app import models

KST = pytz.timezone("Asia/Seoul")
_YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

EXCHANGE_RATES = [
    {"symbol": "KRW=X", "currency": "USD"},
    {"symbol": "JPYKRW=X", "currency": "JPY"},
    {"symbol": "EURKRW=X", "currency": "EUR"},
]


async def fetch_and_save_exchange_rates(db: Session) -> bool:
    """
    Yahoo Finance에서 환율 조회 후 DB에 저장
    Returns: 성공 여부
    """
    now = datetime.now(KST)
    c_date = now.date()
    c_time = f"{now.hour:02d}:{now.minute:02d}"

    results = []
    async with httpx.AsyncClient(headers=_YAHOO_HEADERS, timeout=15.0) as client:
        for item in EXCHANGE_RATES:
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{item['symbol']}?interval=1d&range=1d"
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                if not data or "chart" not in data or "result" not in data["chart"] or not data["chart"]["result"]:
                    continue
                result = data["chart"]["result"][0]
                meta = result.get("meta", {})
                price = meta.get("regularMarketPrice") or meta.get("chartPreviousClose") or meta.get("previousClose")
                prev = meta.get("previousClose") or meta.get("chartPreviousClose") or price
                if price is None or prev is None:
                    continue
                display_price = float(price)
                prev_price = float(prev)
                if item["symbol"] == "JPYKRW=X" and price < 20:
                    display_price = price * 100
                    prev_price = prev * 100
                change_val = display_price - prev_price
                results.append({
                    "symbol": item["symbol"],
                    "currency": item["currency"],
                    "rate": display_price,
                    "change_val": change_val,
                })
            except Exception as e:
                print(f"⚠️ 환율 {item['symbol']} 조회 실패: {e}")

    if not results:
        return False

    for r in results:
        db.add(models.ExchangeRateSnapshot(
            symbol=r["symbol"],
            currency=r["currency"],
            rate=r["rate"],
            change_val=r["change_val"],
            collected_at=now,
            collected_date=c_date,
            collected_time=c_time,
        ))
    db.commit()
    return True
