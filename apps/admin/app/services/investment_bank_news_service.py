"""
투자은행 뉴스 (GS, MS, JPM, Citi, BofA, Barclays, UBS, Jefferies, BlackRock, Vanguard, Fidelity) - Yahoo Finance 검색 API로 금융·주식·코인 뉴스 수집
매일 12:00 KST 실행
Yahoo 뉴스(영어) → Gemini 한글 번역 후 DB 저장
"""
import re
import httpx
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.engine.models import InvestmentBankNews
from app.services.gemini_response_utils import extract_text_from_generate_content_response

_YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# GS, MS, JPM, Citi, BofA, Barclays, UBS, Jefferies, BlackRock, Vanguard, Fidelity 검색어
SEARCH_QUERIES = [
    ("GS", "Goldman Sachs Korea stock"),
    ("GS", "Goldman Sachs 한국"),
    ("MS", "Morgan Stanley Korea stock"),
    ("MS", "Morgan Stanley 한국"),
    ("JPM", "JP Morgan Korea stock"),
    ("JPM", "JP Morgan 한국"),
    ("Citi", "Citibank Korea stock"),
    ("Citi", "Citibank 한국"),
    ("BofA", "Bank of America Korea stock"),
    ("BofA", "Bank of America 한국"),
    ("Barclays", "Barclays Korea stock"),
    ("Barclays", "Barclays 한국"),
    ("UBS", "UBS Korea stock"),
    ("UBS", "UBS 한국"),
    ("Jefferies", "Jefferies Korea stock"),
    ("Jefferies", "Jefferies 한국"),
    ("BlackRock", "BlackRock Korea stock"),
    ("BlackRock", "BlackRock 한국"),
    ("Vanguard", "Vanguard Korea stock"),
    ("Vanguard", "Vanguard 한국"),
    ("Fidelity", "Fidelity Korea stock"),
    ("Fidelity", "Fidelity 한국"),
]

# 금융·주식·코인 관련 키워드 (제목/요약에 있으면 수집, 없으면 제외)
FINANCE_KEYWORDS = [
    # 영어
    "finance", "stock", "stocks", "crypto", "cryptocurrency", "bitcoin", "ethereum",
    "market", "investment", "banking", "economy", "trading", "forex", "bonds",
    "ipo", "m&a", "asset", "portfolio", "equity", "derivative", "fed", "rate",
    # 한글
    "금융", "주식", "코인", "비트코인", "암호화폐", "시장", "투자", "은행", "경제",
    "거래", "채권", "증시", "코스피", "코스닥", "환율", "이자", "리포트",
]


def _strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _is_finance_related(title: str, summary: str) -> bool:
    """금융·주식·코인 관련 뉴스만 수집"""
    combined = f"{title} {summary}".lower()
    return any(kw.lower() in combined for kw in FINANCE_KEYWORDS)


def _parse_translation_json(text: str) -> Optional[Tuple[str, str]]:
    """번역 JSON 파싱 (마크다운/추가 텍스트 포함 응답 대응)"""
    if not text or not text.strip():
        return None
    text = text.strip()
    # ```json ... ``` 또는 ``` ... ``` 제거
    if "```" in text:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            text = m.group(1).strip()
        else:
            text = re.sub(r"^```\w*\n?", "", text).strip()
            text = re.sub(r"\n?```\s*$", "", text).strip()
    # {...} 블록 추출 (앞뒤 설명문 제거)
    brace = text.find("{")
    if brace >= 0:
        depth = 0
        end = -1
        for i, c in enumerate(text[brace:], brace):
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end >= 0:
            text = text[brace : end + 1]
    import json
    try:
        data = json.loads(text)
        if isinstance(data, dict) and data.get("title"):
            return (str(data.get("title", "")).strip(), str(data.get("summary", "")).strip())
    except json.JSONDecodeError:
        pass
    return None


def _translate_with_gemini(title: str, summary: str) -> Optional[Tuple[str, str]]:
    """영어 뉴스 제목·요약을 Gemini로 한글로 번역. Returns (translated_title, translated_summary) or None"""
    # [2026-08-03 Gemini 제거] 비용 절감 — 모든 Gemini 호출 차단
    return None
    if not GEMINI_API_KEY:
        return None
    prompt = f"""다음 영어 뉴스의 제목과 요약을 자연스러운 한국어로 번역해주세요.
반드시 아래 JSON 형식만 출력하세요. 다른 설명, 마크다운, 코드블록 없이 순수 JSON만.

영어 제목: {title}
영어 요약: {summary}

응답 (JSON만):
{{"title": "한글 제목", "summary": "한글 요약"}}"""
    for attempt in range(3):
        try:
            from google import genai
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            text = extract_text_from_generate_content_response(
                response, log_prefix="투자은행 뉴스", log_if_empty=True
            )
            if not text:
                continue
            result = _parse_translation_json(text)
            if result:
                return result
            # JSON 파싱 실패 시 응답 텍스트에서 첫 줄을 제목으로 사용
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            if lines and len(lines[0]) > 5:
                translated_title = lines[0][:500]
                translated_summary = " ".join(lines[1:])[:2000] if len(lines) > 1 else ""
                return (translated_title, translated_summary)
        except Exception as e:
            print(f"[투자은행 뉴스] Gemini 번역 오류 (attempt {attempt + 1}): {e}")
    return None


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
    GS, MS, JPM, Citi, BofA, Barclays, UBS, Jefferies, BlackRock, Vanguard, Fidelity Yahoo 뉴스 수집 → 금융·주식·코인 관련만 DB 저장 (pending)
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

            if not _is_finance_related(title, summary):
                continue

            seen_urls.add(url)

            existing = db.query(InvestmentBankNews).filter(
                InvestmentBankNews.source_url == url,
            ).first()
            if existing:
                continue

            # 영어 → 한글 번역 (Gemini)
            translated = _translate_with_gemini(title, summary)
            if translated:
                title, summary = translated[0], translated[1]
            # 번역 실패 시 원문 그대로 저장

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
