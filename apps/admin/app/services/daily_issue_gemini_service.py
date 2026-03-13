"""
금일 이슈 Gemini AI 요약 서비스

naver_stock_news에 수집된 오늘 뉴스를 Gemini에 전달해
투자자 관점의 "금일 이슈" 요약을 생성·저장한다.
"""
from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session
import pytz

from app.config import GEMINI_API_KEY
from app.models import NaverStockNews


def _get_today_news(db: Session, target_date: date, limit: int = 50) -> list[dict]:
    """오늘 수집된 뉴스 조회 (collected_at 기준, KST)"""
    kst = pytz.timezone("Asia/Seoul")
    start = kst.localize(datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0))
    end = kst.localize(datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59))
    rows = (
        db.query(NaverStockNews)
        .filter(NaverStockNews.collected_at >= start, NaverStockNews.collected_at <= end)
        .order_by(NaverStockNews.pub_datetime.desc().nullslast(), NaverStockNews.collected_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"category": r.category, "title": (r.title or "").strip(), "description": (r.description or "").strip()[:200]}
        for r in rows
    ]


def _build_prompt(news_list: list[dict]) -> str:
    if not news_list:
        return ""
    lines = []
    for i, n in enumerate(news_list[:30], 1):  # 최대 30건
        cat = n.get("category", "")
        title = n.get("title", "")
        desc = n.get("description", "")
        line = f"{i}. [{cat}] {title}"
        if desc:
            line += f"\n   {desc}"
        lines.append(line)
    news_section = "\n\n".join(lines)
    return f"""다음은 오늘 수집된 주가 영향 뉴스입니다.
한국 개인 주식 투자자를 위해 "금일 이슈"를 3~5개 불릿 포인트로 요약해주세요.

[뉴스 목록]
{news_section}

작성 규칙:
- 핵심 이슈만 추려 3~5개 불릿으로 정리
- 각 항목 1~2문장, 자연스러운 한국어
- 투자 관점에서 주목할 만한 포인트 위주
- 마크다운, JSON, 코드블록 없이 순수 텍스트만 응답
- "금일 이슈" 제목 없이 본문만 작성
"""


def _call_gemini(prompt: str) -> Optional[str]:
    if not GEMINI_API_KEY:
        print("[daily-issue-gemini] GEMINI_API_KEY 없음, 건너뜀")
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = ""
        parts = getattr(response, "parts", None)
        if parts:
            for part in parts:
                if getattr(part, "thought", False):
                    continue
                pt = getattr(part, "text", None)
                if pt:
                    text += str(pt)
        if not text and hasattr(response, "text"):
            text = (response.text or "").strip()
        return (text or "").strip() or None
    except Exception as e:
        print(f"[daily-issue-gemini] Gemini 호출 오류: {e}")
        return None


def generate_and_save_daily_issue_summary(db: Session, target_date: date) -> bool:
    """
    오늘 뉴스를 Gemini로 요약하고 daily_issue_summaries에 저장(upsert)한다.

    Returns:
        True if saved, False on failure
    """
    news_list = _get_today_news(db, target_date)
    if not news_list:
        print(f"[daily-issue-gemini] {target_date} 뉴스 없음, 건너뜀")
        return False

    prompt = _build_prompt(news_list)
    summary = _call_gemini(prompt)
    if not summary:
        return False

    from sqlalchemy import text
    db.execute(text("""
        INSERT INTO daily_issue_summaries (date, summary)
        VALUES (:date, :summary)
        ON CONFLICT (date) DO UPDATE SET summary = EXCLUDED.summary
    """), {"date": target_date, "summary": summary})
    db.commit()
    print(f"[daily-issue-gemini] 금일 이슈 요약 저장 완료 ({target_date})")
    return True
