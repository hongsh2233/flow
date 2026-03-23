"""
아침 시장 요약 Gemini AI 처리 서비스

수집된 지수/환율 데이터를 Gemini에 전달하고 구조화된 코멘트를 생성·저장한다.
응답 형식:
  - us_market:        전일 뉴욕증시 코멘트 (나스닥/S&P500/다우)
  - overnight_issues: 밤사이 미국·글로벌 주요이슈 (3~5개 불릿)
  - kr_indices:       한국 관련 지수 코멘트 (코스피200 선물, MSCI Korea 등)
  - exchange_rate:    환율 코멘트 (달러원 위주)
  - today_schedule:   당일 주요일정 요약
  - kr_focus:         한국증시 주목할점
"""
import json
import re
from datetime import date
from typing import Optional, Dict, List
from sqlalchemy.orm import Session

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.engine.models import MarketMorningAiSummary
from app.services.gemini_response_utils import (
    extract_first_json_object,
    extract_text_from_generate_content_response,
)

# symbol → 출력명 매핑
_SYMBOL_NAME = {
    "^IXIC":   "나스닥",
    "^GSPC":   "S&P500",
    "^DJI":    "다우",
    "^SOX":    "필라델피아 반도체",
    "NQ=F":    "나스닥 선물",
    "^KS200":  "코스피200",
    "INV:8893":"코스피200 야간선물",
    "^MSKR":   "MSCI Korea",
    "EWY":     "EWY(한국 ETF)",
    "^KS11":   "코스피",
    "^KQ11":   "코스닥",
}

_US_SYMBOLS = {"^IXIC", "^GSPC", "^DJI", "^SOX", "NQ=F"}
_KR_SYMBOLS = {"^KS200", "INV:8893", "^MSKR", "EWY", "^KS11", "^KQ11"}


def _build_prompt(
    indices: list[dict],
    exchange_rates: list[dict],
    overnight_news: List[dict] = [],
    today_schedules: List[dict] = [],
) -> str:
    us_lines = []
    kr_lines = []
    for idx in indices:
        sym = idx.get("symbol", "")
        name = _SYMBOL_NAME.get(sym, idx.get("name", sym))
        price = idx.get("price", 0)
        chg = idx.get("change", 0)
        pct = idx.get("changePercent", 0)
        # Fix: use :+.2f only (no extra sign prefix → no double ++)
        line = f"- {name}: {price:,.2f} ({chg:+.2f}, {pct:+.2f}%)"
        if sym in _US_SYMBOLS:
            us_lines.append(line)
        elif sym in _KR_SYMBOLS:
            kr_lines.append(line)

    ex_lines = []
    for ex in exchange_rates:
        currency = ex.get("currency", "")
        rate = ex.get("rate", 0)
        chg = ex.get("change", 0)
        ex_lines.append(f"- {currency}: {rate:,.2f} ({chg:+.2f})")

    us_section = "\n".join(us_lines) if us_lines else "- 데이터 없음"
    kr_section = "\n".join(kr_lines) if kr_lines else "- 데이터 없음"
    ex_section = "\n".join(ex_lines) if ex_lines else "- 데이터 없음"

    # 밤사이 뉴스 섹션
    news_lines = []
    for n in overnight_news:
        title = n.get("title", "").strip()
        if title:
            news_lines.append(f"- {title}")
    news_section = "\n".join(news_lines) if news_lines else "- 데이터 없음"

    # 당일 일정 섹션
    sched_lines = []
    for s in today_schedules:
        time_str = s.get("time", "")
        subject = s.get("subject", "").strip()
        content = s.get("content", "").strip()
        if subject:
            entry = f"- [{time_str}] {subject}" if time_str else f"- {subject}"
            if content:
                entry += f" ({content})"
            sched_lines.append(entry)
    sched_section = "\n".join(sched_lines) if sched_lines else "- 없음"

    return f"""다음은 오늘 아침 수집된 전일 뉴욕증시 마감 데이터, 관련 지수, 환율, 밤사이 주요 뉴스, 당일 주요 일정입니다.
한국 개인 주식 투자자를 위해 아래 JSON 형식으로 간결한 시황 코멘트를 작성해주세요.

[전일 미국 증시 · 선물]
{us_section}

[한국 관련 지수]
{kr_section}

[환율]
{ex_section}

[밤사이 주요 뉴스]
{news_section}

[당일 주요 일정]
{sched_section}

작성 규칙:
- us_market: 전일 미국증시 주요 내용 3가지를 각각 1~2문장으로 작성 (나스닥·S&P500·다우 수치 포함). ① ② ③ 형식
- overnight_issues: 밤사이 미국·글로벌 핵심이슈 3~5개를 불릿(•) 형식으로, 각 1~2문장
- kr_indices: 한국 관련 지수(MSCI Korea, EWY, 코스피200 선물 등) 요약 1~2문장
- exchange_rate: 달러원 환율 위주 1문장
- today_schedule: 당일 주요 일정 요약. 일정 없으면 빈 문자열("") 반환
- kr_focus: 오늘 한국증시에서 주목해야 할 핵심 포인트 2~3문장 (미국 지수 흐름이 한국에 미칠 영향 등)
- 수치 변화(상승/하락)와 맥락을 함께 서술
- 절대 JSON 외 다른 텍스트나 마크다운 코드블록(```)을 포함하지 말 것

응답 형식 (반드시 이 JSON만 응답):
{{
  "us_market": "① 첫 번째 주요 내용\\n② 두 번째 주요 내용\\n③ 세 번째 주요 내용",
  "overnight_issues": "• 이슈1\\n• 이슈2\\n• 이슈3",
  "kr_indices": "한국 관련 지수 요약",
  "exchange_rate": "환율 요약 (달러원 위주, 1문장)",
  "today_schedule": "당일 주요 일정 요약 또는 빈 문자열",
  "kr_focus": "한국증시에서 주목할점 (2~3문장)"
}}"""


def _call_gemini(prompt: str) -> Optional[Dict[str, str]]:
    if not GEMINI_API_KEY:
        print("[morning-gemini] GEMINI_API_KEY 없음, 건너뜀")
        return None
    text = ""
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        text = extract_text_from_generate_content_response(
            response, log_prefix="morning-gemini", log_if_empty=True
        )

        # 코드블록 제거 (위치 무관 - thinking 잔류 텍스트 뒤에 올 수 있으므로 앵커 없이)
        text = re.sub(r"```(?:json)?\s*", "", text)
        text = re.sub(r"```", "", text)
        json_blob = extract_first_json_object(text)
        if not json_blob:
            print(f"[morning-gemini] JSON 블록 추출 실패, 원문(첫 400자): {text[:400]!r}")
            return None
        data = json.loads(json_blob)
        return {
            "us_market":        str(data.get("us_market", "") or "").strip(),
            "overnight_issues": str(data.get("overnight_issues", "") or "").strip(),
            "kr_indices":       str(data.get("kr_indices", "") or "").strip(),
            "exchange_rate":    str(data.get("exchange_rate", "") or "").strip(),
            "today_schedule":   str(data.get("today_schedule", "") or "").strip(),
            "kr_focus":         str(data.get("kr_focus", "") or "").strip(),
        }
    except Exception as e:
        print(f"[morning-gemini] Gemini 호출 오류: {e}")
        print(f"[morning-gemini] 응답 텍스트(첫 300자): {text[:300]!r}")
        return None


def generate_and_save_ai_summary(
    db: Session,
    indices: list[dict],
    exchange_rates: list[dict],
    target_date: date,
    overnight_news: List[dict] = [],
    today_schedules: List[dict] = [],
) -> bool:
    """
    지수·환율·뉴스·일정 데이터를 Gemini로 전달해 AI 요약을 생성하고 DB에 저장(upsert)한다.

    Returns:
        True if saved, False on failure
    """
    prompt = _build_prompt(indices, exchange_rates, overnight_news, today_schedules)
    result = _call_gemini(prompt)
    if not result:
        return False

    existing = db.query(MarketMorningAiSummary).filter(
        MarketMorningAiSummary.date == target_date
    ).first()

    if existing:
        existing.us_market = result["us_market"]
        existing.overnight_issues = result["overnight_issues"]
        existing.kr_indices = result["kr_indices"]
        existing.exchange_rate = result["exchange_rate"]
        existing.today_schedule = result["today_schedule"]
        existing.kr_focus = result["kr_focus"]
    else:
        db.add(MarketMorningAiSummary(
            date=target_date,
            us_market=result["us_market"],
            overnight_issues=result["overnight_issues"],
            kr_indices=result["kr_indices"],
            exchange_rate=result["exchange_rate"],
            today_schedule=result["today_schedule"],
            kr_focus=result["kr_focus"],
        ))
    db.commit()
    print(f"[morning-gemini] AI 요약 저장 완료 ({target_date})")
    return True
