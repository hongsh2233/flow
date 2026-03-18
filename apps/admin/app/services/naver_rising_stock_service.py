"""
네이버증권 상승률 상위 종목 수집 서비스

네이버증권 sise_rise.naver 페이지에서 10%이상 상승 종목을 스크래핑합니다.
- 코스피: https://finance.naver.com/sise/sise_rise.naver?sosok=0
- 코스닥: https://finance.naver.com/sise/sise_rise.naver?sosok=1

하루 3회 수집: 12:00 / 15:40 / 20:30 (KST)
"""
import re
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import pytz

from app.engine.models import NaverRisingStock

KST = pytz.timezone("Asia/Seoul")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://finance.naver.com/sise/",
}

MARKET_SOSOK = {
    "kospi": "0",
    "kosdaq": "1",
}

MIN_CHANGE_PERCENT = 10.0


def _parse_number(text: str) -> str:
    if not text:
        return ""
    return text.replace(",", "").strip()


def _parse_change_percent(text: str) -> str:
    """등락률 문자열 정규화: '상승'/'하락' 텍스트 → +/-"""
    if not text:
        return ""
    text = text.strip()
    if "상승" in text:
        m = re.search(r"([\d.]+)", text)
        return f"+{m.group(1)}%" if m else text
    if "하락" in text:
        m = re.search(r"([\d.]+)", text)
        return f"-{m.group(1)}%" if m else text
    if text.startswith(("+", "-")):
        return text
    m = re.search(r"([\d.]+)", text)
    if m:
        val = float(m.group(1))
        sign = "+" if val > 0 else "-" if val < 0 else ""
        return f"{sign}{val}%"
    return text


def _parse_stock_code(href: str) -> str:
    if not href:
        return ""
    m = re.search(r"code=(\d{6})", href)
    return m.group(1) if m else ""


def _extract_float(text: str) -> float:
    """등락률에서 float 추출 ('+15.23%' → 15.23, '-5.00%' → -5.00)"""
    if not text:
        return 0.0
    clean = text.replace("%", "").replace(",", "").strip()
    try:
        return float(clean)
    except ValueError:
        return 0.0


async def _fetch_rising_page(market_type: str, page: int = 1) -> List[Dict]:
    """네이버증권 상승률 상위 페이지 1페이지 스크래핑"""
    sosok = MARKET_SOSOK.get(market_type, "0")
    url = f"https://finance.naver.com/sise/sise_rise.naver?sosok={sosok}"

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                print(f"[상승종목] HTTP {resp.status_code} for {market_type}")
                return []
            # 네이버는 EUC-KR 인코딩
            html = resp.content.decode("euc-kr", errors="replace")
        except Exception as e:
            print(f"[상승종목] 요청 오류 ({market_type}): {e}")
            return []

    soup = BeautifulSoup(html, "html.parser")
    # 종목 테이블: class="type_2"
    table = soup.find("table", class_="type_2")
    if not table:
        print(f"[상승종목] 테이블을 찾지 못했습니다 ({market_type})")
        return []

    results = []
    tbody = table.find("tbody")
    if not tbody:
        tbody = table

    for tr in tbody.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 7:
            continue
        # 빈 행 스킵
        if not tds[0].get_text(strip=True):
            continue

        rank_text = tds[0].get_text(strip=True)
        if not rank_text.isdigit():
            continue

        rank = int(rank_text)
        name_tag = tds[1].find("a")
        if not name_tag:
            continue
        stock_name = name_tag.get_text(strip=True)
        href = name_tag.get("href", "")
        stock_code = _parse_stock_code(href)

        current_price = _parse_number(tds[2].get_text(strip=True))
        change = _parse_number(tds[3].get_text(strip=True))
        change_percent = _parse_change_percent(tds[4].get_text(strip=True))
        volume = _parse_number(tds[6].get_text(strip=True))

        # 10% 이상만 수집
        pct_val = _extract_float(change_percent)
        if pct_val < MIN_CHANGE_PERCENT:
            continue

        results.append({
            "rank": rank,
            "stock_code": stock_code,
            "stock_name": stock_name,
            "current_price": current_price,
            "change": change,
            "change_percent": change_percent,
            "volume": volume,
        })

    return results


async def collect_and_save(db: Session) -> Dict[str, int]:
    """
    코스피/코스닥 상승률 10%이상 종목 수집 후 DB 저장.
    새 데이터가 들어오면 기존 데이터를 전부 삭제하고 최신 데이터만 보관.
    Returns: {"kospi": N, "kosdaq": M}
    """
    now_kst = datetime.now(KST)
    collected_time = now_kst.strftime("%H:%M")
    collected_at = now_kst.replace(second=0, microsecond=0)

    totals: Dict[str, int] = {}

    for market_type in ("kospi", "kosdaq"):
        items = await _fetch_rising_page(market_type)
        saved = 0

        if items:
            # 기존 데이터 전부 삭제 후 최신 데이터만 저장
            db.query(NaverRisingStock).filter(
                NaverRisingStock.market_type == market_type,
            ).delete(synchronize_session=False)

            for item in items:
                row = NaverRisingStock(
                    market_type=market_type,
                    rank=item["rank"],
                    stock_code=item["stock_code"],
                    stock_name=item["stock_name"],
                    current_price=item["current_price"],
                    change=item["change"],
                    change_percent=item["change_percent"],
                    volume=item["volume"],
                    collected_at=collected_at,
                    collected_time=collected_time,
                )
                db.add(row)
                saved += 1

        totals[market_type] = saved
        print(f"[상승종목] {market_type.upper()} {collected_time} → {saved}개 저장")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[상승종목] DB 저장 오류: {e}")
        raise

    return totals


def get_latest_rising_stocks(db: Session, market_type: str, limit: int = 100) -> Dict:
    """
    최신 수집 슬롯의 상승종목 조회.
    Returns: {"data": [...], "collected_time": "HH:MM", "count": N}
    """
    # 최신 collected_at 조회
    latest_at = (
        db.query(func.max(NaverRisingStock.collected_at))
        .filter(NaverRisingStock.market_type == market_type)
        .scalar()
    )
    if not latest_at:
        return {"data": [], "collected_time": None, "count": 0}

    rows = (
        db.query(NaverRisingStock)
        .filter(
            NaverRisingStock.market_type == market_type,
            NaverRisingStock.collected_at == latest_at,
        )
        .order_by(NaverRisingStock.rank)
        .limit(limit)
        .all()
    )

    data = [
        {
            "rank": r.rank,
            "stock_code": r.stock_code,
            "stock_name": r.stock_name,
            "current_price": r.current_price,
            "change": r.change,
            "change_percent": r.change_percent,
            "volume": r.volume,
            "collected_time": r.collected_time,
        }
        for r in rows
    ]
    collected_time = rows[0].collected_time if rows else None
    return {"data": data, "collected_time": collected_time, "count": len(data)}
