"""
투자은행 뉴스 (GS, MS, JPM) - Yahoo Finance 검색 API로 한국증시 관련 뉴스 수집
매일 12:00 KST 실행
"""
import re
import httpx
from typing import List, Dict
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.engine.models import InvestmentBankNews

_YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# GS, MS, JPM 각각 한국증시 관련 검색어
SEARCH_QUERIES = [
    ("GS", "Goldman Sachs Korea stock"),
    ("GS", "Goldman Sachs 한국"),
    ("MS", "Morgan Stanley Korea stock"),
    ("MS", "Morgan Stanley 한국"),
    ("JPM", "JP Morgan Korea stock"),
    ("JPM", "JP Morgan 한국"),
]

# 한국 관련 키워드 (제목/요약에 있으면 수집)
KR_KEYWORDS = [
    "korea", "한국", "kospi", "코스피", "kosdaq", "코스닥", "seoul", "서울",
    "samsung", "삼성", "hyundai", "현대", "sk", "lg", "korean", "한국증시",
]


def _strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _is_korea_related(title: str, summary: str) -> bool:
    combined = f"{title} {summary}".lower()
    return any(kw.lower() in combined for kw in KR_KEYWORDS)


async def _fetch_yahoo_search_news(query: str, news_count: int = 10) -> List[Dict]:
    """Yahoo Finance v1 search API로 뉴스 조회"""
    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {"q": query, "newsCount": news_count, "quotesCount": 0}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, params=params, headers=_YAHOO_HEADERS)
            if resp.status_code != 200:
                return []
            data = resp.json()
            news_list = data.get("news") or []
            return [
                {
                    "title": _strip_html(n.get("title", "")),
                    "summary": _strip_html(n.get("summary", "") or n.get("content", "")),
                    "url": (n.get("url") or n.get("link") or "").strip(),
                    "pub_date": n.get("providerPublishTime") or n.get("published_at") or "",
                }
                for n in news_list
            ]
        except Exception as e:
            print(f"[투자은행 뉴스] Yahoo 검색 오류 (q={query}): {e}")
            return []


async def fetch_and_save_investment_bank_news(db: Session) -> Dict[str, int]:
    """
    GS, MS, JPM Yahoo 뉴스 수집 → 한국 관련만 DB 저장 (pending)
    Returns: {"fetched": N, "saved": M}
    """
    total_fetched = 0
    total_saved = 0
    seen_urls = set()

    for source, query in SEARCH_QUERIES:
        news_list = await _fetch_yahoo_search_news(query, news_count=8)
        total_fetched += len(news_list)

        for item in news_list:
            url = (item.get("url") or "").strip()
            if not url or url in seen_urls:
                continue

            title = (item.get("title") or "").strip()
            summary = (item.get("summary") or "").strip()
            if not title:
                continue

            if not _is_korea_related(title, summary):
                continue

            seen_urls.add(url)

            existing = db.query(InvestmentBankNews).filter(
                InvestmentBankNews.source_url == url,
            ).first()
            if existing:
                continue

            pub_date = item.get("pub_date")
            if isinstance(pub_date, (int, float)):
                try:
                    dt = datetime.fromtimestamp(pub_date, tz=timezone.utc)
                    pub_date = dt.strftime("%Y-%m-%d %H:%M")
                except Exception:
                    pub_date = None

            news = InvestmentBankNews(
                source=source,
                title=title[:500],
                summary=summary[:2000] if summary else None,
                source_url=url[:1000] if url else None,
                status="pending",
                news_pub_date=str(pub_date) if pub_date else None,
            )
            db.add(news)
            total_saved += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise

    return {"fetched": total_fetched, "saved": total_saved}
