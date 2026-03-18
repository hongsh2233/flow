"""
시장의 목소리: person_master 인물 이름으로 뉴스 수집 → Gemini AI 50자 이내 요약 → market_voices pending 저장

- NAVER_CLIENT_ID, NAVER_CLIENT_SECRET: 뉴스 검색
- GEMINI_API_KEY: AI 요약
"""
import re
import httpx
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
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


def _is_within_24h(pub_date_str: str) -> bool:
    """뉴스 발행일이 현재 기준 72시간 이내인지 확인 (24h→72h 완화로 수집 확대)"""
    if not pub_date_str:
        return False
    try:
        dt = parsedate_to_datetime(pub_date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
        return dt >= cutoff
    except Exception:
        return False


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


def _extract_text_from_gemini_response(response, debug_on_empty: bool = False) -> str:
    """
    Gemini 응답에서 텍스트 추출.
    SDK별로 response.text, response.parts, response.candidates 경로가 다를 수 있으므로
    여러 경로를 시도한다.
    """
    text = ""

    # 1) response.parts (SDK 권장 경로 - GenerateContentResponse.parts)
    parts = getattr(response, "parts", None)
    if parts:
        for part in parts:
            pt = getattr(part, "text", None)
            if pt:
                text += str(pt)

    # 2) response.text
    if not text:
        try:
            if hasattr(response, "text"):
                text = (response.text or "").strip()
        except (ValueError, AttributeError) as e:
            if debug_on_empty:
                print(f"[시장의 목소리] response.text 접근 실패: {e}")

    # 3) response.candidates[].content.parts[]
    if not text:
        candidates = getattr(response, "candidates", []) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            c_parts = getattr(content, "parts", []) or []
            for part in c_parts:
                pt = getattr(part, "text", None)
                if pt:
                    text += str(pt)
            if text:
                break

    if debug_on_empty and not text:
        pf = getattr(response, "prompt_feedback", None)
        block_reason = getattr(pf, "block_reason", None) if pf else None
        print(f"[시장의 목소리] Gemini 빈 응답 - candidates={len(getattr(response, 'candidates', []) or [])}, "
              f"parts={len(parts) if parts else 0}, block_reason={block_reason}")

    return (text or "").strip()


def _summarize_with_gemini(person_name: str, title: str, description: str) -> Optional[str]:
    """Gemini API로 '누가 어떤 핵심 발언을 했는지' 50자 이내 요약"""
    if not GEMINI_API_KEY:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""다음 뉴스를 50자 이내 한 문장으로 요약해주세요.
- "{person_name}"의 직접 발언이 있으면 발언 내용을 중심으로 요약하세요.
- 직접 발언이 없으면 뉴스의 핵심 내용을 "{person_name}"을 주어로 요약하세요.
- 반드시 "~했다", "~밝혔다", "~전망했다" 등 한 문장으로 끝내주세요.
- 50자를 초과하면 안 됩니다. 다른 설명 없이 요약문만 출력하세요.

뉴스 제목: {title}
뉴스 요약: {description}

요약 (50자 이내):"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = _extract_text_from_gemini_response(response, debug_on_empty=True)
        # (N자) 패턴 제거: "(33자)", "(50자 이내)" 등
        text = re.sub(r'\s*\(\d+자[^)]*\)', '', text).strip()
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
    # 디버깅: 각 단계별 스킵 건수
    skip_link = 0
    skip_24h = 0
    skip_empty_content = 0
    skip_gemini_empty = 0
    skip_existing = 0

    for person in persons:
        news_list = await _search_news_by_keyword(person.search_keyword, display=MAX_NEWS_PER_PERSON)
        total_fetched += len(news_list)

        for item in news_list:
            link = (item.get("link") or "").strip()
            if not link or link in seen_urls:
                skip_link += 1
                continue

            # 24시간 이내 발행된 뉴스만 수집
            if not _is_within_24h(item.get("pub_date", "")):
                skip_24h += 1
                continue

            seen_urls.add(link)

            title = item.get("title") or ""
            description = item.get("description") or ""
            if not title and not description:
                skip_empty_content += 1
                continue

            statement = _summarize_with_gemini(person.name, title, description)
            if not statement:
                skip_gemini_empty += 1
                continue

            existing = db.query(MarketVoice).filter(
                MarketVoice.person_id == person.id,
                MarketVoice.source_url == link,
            ).first()
            if existing:
                skip_existing += 1
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
    if total_saved == 0 and total_fetched > 0:
        skip_detail = (f"스킵: 24h초과={skip_24h}, Gemini빈응답={skip_gemini_empty}, "
                       f"기존존재={skip_existing}, 링크중복={skip_link}, 내용없음={skip_empty_content}")
        print(f"[시장의 목소리] {skip_detail}")
    return {
        "fetched": total_fetched,
        "saved": total_saved,
        "skip_24h": skip_24h,
        "skip_gemini_empty": skip_gemini_empty,
        "skip_existing": skip_existing,
    }
