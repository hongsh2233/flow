"""
시장의 목소리: person_master 인물 이름으로 뉴스 수집 → Gemini AI 30자 이내 요약 → market_voices pending 저장

- NAVER_CLIENT_ID, NAVER_CLIENT_SECRET: 뉴스 검색
- GEMINI_API_KEY: AI 요약
"""
import re
import httpx
from typing import List, Dict, Optional
from datetime import datetime
from email.utils import parsedate_to_datetime
from sqlalchemy.orm import Session
import pytz

from app.config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, GEMINI_API_KEY
from app.engine.models import PersonMaster, MarketVoice

NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
MAX_NEWS_PER_PERSON = 5
STATEMENT_MAX_LEN = 50


def _strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _parse_pub_date(pub_date_str: str) -> Optional[str]:
    if not pub_date_str:
        return None
    try:
        parsedate_to_datetime(pub_date_str)
        return pub_date_str
    except Exception:
        return pub_date_str


async def _search_news_by_keyword(keyword: str, display: int = MAX_NEWS_PER_PERSON) -> List[Dict]:
    """네이버 뉴스 API로 키워드 검색"""
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return []
    params = {"query": keyword, "display": min(display, 100), "start": 1, "sort": "date"}
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            result = await client.get(NAVER_NEWS_API_URL, params=params, headers=headers)
            result.raise_for_status()
            data = result.json()
            items = data.get("items", [])
            return [
                {
                    "title": _strip_html(item.get("title", "")),
                    "description": _strip_html(item.get("description", "")),
                    "link": item.get("link", ""),
                    "pub_date": item.get("pubDate", ""),
                }
                for item in items
            ]
        except Exception as e:
            print(f"[시장의 목소리] 뉴스 검색 오류 (키워드: {keyword}): {e}")
            return []


def _summarize_with_gemini(person_name: str, title: str, description: str) -> Optional[str]:
    """Gemini API로 '누가 어떤 핵심 발언을 했는지' 30자 이내 요약"""
    if not GEMINI_API_KEY:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""다음 뉴스에서 "{person_name}"의 핵심 발언을 50자 이내로 요약해주세요.
반드시 "~했다", "~했다고 밝혔다" 등 한 문장으로 끝내주세요.
50자를 초과하면 안 됩니다.

뉴스 제목: {title}
뉴스 요약: {description}

요약 (30자 이내):"""
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        text = response.text if hasattr(response, "text") else ""
        if not text:
            candidates = getattr(response, "candidates", []) or []
            if candidates:
                parts = getattr(candidates[0], "content", None) and getattr(candidates[0].content, "parts", []) or []
                if parts:
                    text = getattr(parts[0], "text", "") or ""
        text = (text or "").strip()
        if len(text) > STATEMENT_MAX_LEN:
            text = text[:STATEMENT_MAX_LEN - 1] + "…"
        return text if text else None
    except Exception as e:
        print(f"[시장의 목소리] Gemini 요약 오류: {e}")
        return None


async def fetch_and_summarize_news(db: Session) -> Dict[str, int]:
    """
    person_master 인물별로 뉴스 수집 → Gemini 요약 → market_voices pending 저장

    Returns:
        {"fetched": N, "saved": M}
    """
    persons = (
        db.query(PersonMaster)
        .filter(PersonMaster.is_active == "active")
        .order_by(PersonMaster.order_index, PersonMaster.id)
        .all()
    )
    if not persons:
        return {"fetched": 0, "saved": 0}

    if not GEMINI_API_KEY:
        print("[시장의 목소리] GEMINI_API_KEY 미설정. 요약 스킵.")
        return {"fetched": 0, "saved": 0}

    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        print("[시장의 목소리] NAVER_CLIENT_ID/SECRET 미설정. 뉴스 수집 스킵.")
        return {"fetched": 0, "saved": 0}

    total_fetched = 0
    total_saved = 0
    seen_urls = set()

    for person in persons:
        news_list = await _search_news_by_keyword(person.search_keyword, display=MAX_NEWS_PER_PERSON)
        total_fetched += len(news_list)

        for item in news_list:
            link = (item.get("link") or "").strip()
            if not link or link in seen_urls:
                continue
            seen_urls.add(link)

            title = item.get("title") or ""
            description = item.get("description") or ""
            if not title and not description:
                continue

            statement = _summarize_with_gemini(person.name, title, description)
            if not statement:
                continue

            existing = db.query(MarketVoice).filter(
                MarketVoice.person_id == person.id,
                MarketVoice.source_url == link,
            ).first()
            if existing:
                continue

            voice = MarketVoice(
                person_id=person.id,
                statement=statement[:100],
                source_url=link[:1000] if link else None,
                source_title=title[:500] if title else None,
                status="pending",
                news_pub_date=_parse_pub_date(item.get("pub_date", "")),
            )
            db.add(voice)
            total_saved += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[시장의 목소리] DB 저장 오류: {e}")
        raise

    print(f"[시장의 목소리] 수집 완료: 조회 {total_fetched}건, 신규 저장 {total_saved}건 (pending)")
    return {"fetched": total_fetched, "saved": total_saved}
