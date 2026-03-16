"""
증권사 목표가 상향 뉴스 수집 → Gemini 가공 결과만 DB 저장

- 네이버 뉴스 검색 (24시간 이내)
- Gemini로 종목명·증권사·목표가·상향/하향 추출
- 추출 성공한 결과만 B002 '목표가 조정' 카테고리에 Post로 등록 (원문 미저장)
"""
import re
import httpx
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from sqlalchemy.orm import Session

from app.config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, GEMINI_API_KEY
from app.engine.models import Board, BoardCategory, Post

NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
BOARD_ID = "B002"
CATEGORY_NAME = "목표가 조정"
MAX_NEWS_PER_QUERY = 15

# 검색 키워드 (목표가 상향/조정 관련)
SEARCH_QUERIES = [
    "목표가 상향",
    "리포트 브리핑 목표가",
    "증권사 목표가 조정",
]


def _strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _is_within_24h(pub_date_str: str) -> bool:
    if not pub_date_str:
        return False
    try:
        dt = parsedate_to_datetime(pub_date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        return dt >= cutoff
    except Exception:
        return False


async def _search_news(keyword: str, display: int = MAX_NEWS_PER_QUERY) -> List[Dict]:
    """네이버 뉴스 API 검색"""
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
            print(f"[목표가 뉴스] 네이버 검색 오류 (q={keyword}): {e}")
            return []


def _extract_gemini_text(response) -> str:
    text = ""
    parts = getattr(response, "parts", None)
    if parts:
        for part in parts:
            pt = getattr(part, "text", None)
            if pt:
                text += str(pt)
    if not text and hasattr(response, "text"):
        try:
            text = (response.text or "").strip()
        except Exception:
            pass
    if not text:
        for c in getattr(response, "candidates", []) or []:
            content = getattr(c, "content", None)
            if not content:
                continue
            for p in getattr(content, "parts", []) or []:
                pt = getattr(p, "text", None)
                if pt:
                    text += str(pt)
                    break
            if text:
                break
    return (text or "").strip()


def _process_with_gemini(title: str, description: str) -> Optional[Dict]:
    """Gemini로 목표가 상향/조정 정보 추출"""
    if not GEMINI_API_KEY:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""다음 뉴스에서 증권사 목표가 조정 정보를 추출해 JSON 형식으로 응답하세요.

뉴스 제목: {title}
뉴스 요약: {description}

응답 형식 (JSON만 출력, 다른 설명 없이):
{{
  "종목명": "회사명 또는 종목명",
  "증권사": "증권사명",
  "목표가": "목표가(예: 50000원)",
  "조정": "상향" 또는 "하향" 또는 "유지",
  "요약": "한 줄 요약 (50자 이내)"
}}

목표가 조정 뉴스가 아니면 null을 반환하세요. JSON만 출력하세요."""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = _extract_gemini_text(response)
        if not text or text.lower() in ("null", "none"):
            return None
        # JSON 파싱 시도
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text).strip()
            text = re.sub(r"\n?```\s*$", "", text).strip()
        import json
        data = json.loads(text)
        if isinstance(data, dict) and data.get("종목명"):
            return data
        return None
    except Exception as e:
        print(f"[목표가 뉴스] Gemini 요약 오류: {e}")
        return None


def _get_or_create_category(db: Session) -> Optional[int]:
    """B002 게시판의 '목표가 조정' 카테고리 ID 반환 (없으면 생성)"""
    board = db.query(Board).filter(Board.id == BOARD_ID).first()
    if not board:
        print(f"[목표가 뉴스] 게시판 {BOARD_ID} 없음")
        return None

    cat = (
        db.query(BoardCategory)
        .filter(
            BoardCategory.board_id == BOARD_ID,
            BoardCategory.name == CATEGORY_NAME,
        )
        .first()
    )
    if cat:
        return cat.id

    max_order = (
        db.query(BoardCategory)
        .filter(BoardCategory.board_id == BOARD_ID)
        .count()
    )
    new_cat = BoardCategory(
        board_id=BOARD_ID,
        name=CATEGORY_NAME,
        order_index=max_order,
    )
    db.add(new_cat)
    db.flush()
    return new_cat.id


def _format_single_post(items: List[Dict]) -> Tuple[str, str]:
    """
    추출된 여러 건을 하나의 게시글 형식으로 가공.
    증권사별로 묶어서 표시:
      신영증권
      삼성전자 목표가 상향 40만원
      반도체 추정실적 600조 달성 예정
      키움증권
      ...
    Returns: (title, content)
    """
    from collections import defaultdict
    by_broker = defaultdict(list)
    for it in items:
        broker = it.get("증권사") or "기타"
        by_broker[broker].append(it)

    lines = []
    for broker in sorted(by_broker.keys()):
        lines.append(f"<p><strong>{broker}</strong></p>")
        for it in by_broker[broker]:
            stock = it.get("종목명", "-")
            adj = it.get("조정", "")
            price = it.get("목표가", "")
            summary = it.get("요약", "")
            line = f"{stock} 목표가 {adj} {price}".strip()
            if summary:
                line += f"<br>{summary}"
            lines.append(f"<p>{line}</p>")
        lines.append("")  # 증권사 간 간격

    content = "\n".join(lines).strip()
    if not content:
        return "", ""

    # 제목: "목표가 조정 브리핑 (YYYY-MM-DD HH:MM)"
    now = datetime.now(timezone.utc)
    try:
        import pytz
        kst = pytz.timezone("Asia/Seoul")
        now_kst = now.astimezone(kst)
        title = f"목표가 조정 브리핑 ({now_kst.strftime('%Y-%m-%d %H:%M')})"
    except Exception:
        title = f"목표가 조정 브리핑 ({now.strftime('%Y-%m-%d %H:%M')})"

    return title[:255], content


async def fetch_and_post_target_price_news(db: Session) -> Dict[str, int]:
    """
    목표가 상향 뉴스 수집 → Gemini 가공 → 하나의 게시글로 B002 등록
    Returns: {"fetched": N, "posted": 0|1, "items": M}
    """
    total_fetched = 0
    seen_urls = set()
    extracted_items: List[Dict] = []

    category_id = _get_or_create_category(db)
    if not category_id:
        return {"fetched": 0, "posted": 0, "items": 0}

    for keyword in SEARCH_QUERIES:
        news_list = await _search_news(keyword, display=MAX_NEWS_PER_QUERY)
        total_fetched += len(news_list)

        for item in news_list:
            link = (item.get("link") or "").strip()
            if not link or link in seen_urls:
                continue
            if not _is_within_24h(item.get("pub_date", "")):
                continue

            title = (item.get("title") or "").strip()
            description = (item.get("description") or "").strip()
            if not title:
                continue

            seen_urls.add(link)
            extracted = _process_with_gemini(title, description)
            if not extracted:
                continue

            extracted_items.append(extracted)

    posted = 0
    if extracted_items:
        post_title, post_content = _format_single_post(extracted_items)
        if post_title and post_content:
            new_post = Post(
                board_id=BOARD_ID,
                category_id=category_id,
                title=post_title,
                content=post_content,
                author="플로우Ai",
            )
            db.add(new_post)
            posted = 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise

    return {"fetched": total_fetched, "posted": posted, "items": len(extracted_items)}
