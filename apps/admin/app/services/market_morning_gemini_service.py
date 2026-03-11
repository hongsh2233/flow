"""
아침 시장 요약 Gemini AI 처리 서비스

수집된 지수/환율 데이터를 Gemini에 전달하고 구조화된 코멘트를 생성·저장한다.
응답 형식:
  - us_market:    전일 뉴욕증시 코멘트 (나스닥/S&P500/다우)
  - kr_indices:   한국 관련 지수 코멘트 (코스피200 선물, MSCI Korea 등)
  - exchange_rate: 환율 코멘트 (달러원 위주)
  - kr_focus:     한국증시 주목할점
"""
import json
import re
from datetime import date
from typing import Optional, Dict
from sqlalchemy.orm import Session

from app.config import GEMINI_API_KEY
from app.engine.models import MarketMorningAiSummary

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


def _build_prompt(indices: list[dict], exchange_rates: list[dict]) -> str:
    us_lines = []
    kr_lines = []
    for idx in indices:
        sym = idx.get("symbol", "")
        name = _SYMBOL_NAME.get(sym, idx.get("name", sym))
        price = idx.get("price", 0)
        chg = idx.get("change", 0)
        pct = idx.get("changePercent", 0)
        sign = "+" if chg >= 0 else ""
        line = f"- {name}: {price:,.2f} ({sign}{chg:+.2f}, {sign}{pct:.2f}%)"
        if sym in _US_SYMBOLS:
            us_lines.append(line)
        elif sym in _KR_SYMBOLS:
            kr_lines.append(line)

    ex_lines = []
    for ex in exchange_rates:
        currency = ex.get("currency", "")
        rate = ex.get("rate", 0)
        chg = ex.get("change", 0)
        sign = "+" if chg >= 0 else ""
        ex_lines.append(f"- {currency}: {rate:,.2f} ({sign}{chg:.2f})")

    us_section = "\n".join(us_lines) if us_lines else "- 데이터 없음"
    kr_section = "\n".join(kr_lines) if kr_lines else "- 데이터 없음"
    ex_section = "\n".join(ex_lines) if ex_lines else "- 데이터 없음"

    return f"""다음은 오늘 아침 수집된 전일 뉴욕증시 마감 데이터와 관련 지수, 환율 데이터입니다.
한국 개인 주식 투자자를 위해 아래 JSON 형식으로 간결한 시황 코멘트를 작성해주세요.

[전일 미국 증시 · 선물]
{us_section}

[한국 관련 지수]
{kr_section}

[환율]
{ex_section}

작성 규칙:
- 각 항목은 1~2문장, 자연스러운 한국어 문장으로 작성
- 수치 변화(상승/하락)와 맥락을 함께 서술
- kr_focus는 오늘 한국 시장에서 주목해야 할 핵심 포인트 (미국 지수 흐름이 한국에 미칠 영향 등)
- 절대 JSON 외 다른 텍스트나 마크다운 코드블록(```)을 포함하지 말 것

응답 형식 (반드시 이 JSON만 응답):
{{
  "us_market": "전일 뉴욕증시 요약 (나스닥·S&P500·다우 포함)",
  "kr_indices": "한국 관련 지수 요약 (코스피200 선물·MSCI Korea 등)",
  "exchange_rate": "환율 요약 (달러원 위주, 1문장)",
  "kr_focus": "한국증시에서 주목할점 (1~2문장)"
}}"""


def _extract_text_from_gemini_response(response) -> str:
    """Gemini 응답에서 텍스트 추출. response.parts → response.text → candidates 순으로 시도."""
    text = ""
    parts = getattr(response, "parts", None)
    if parts:
        for part in parts:
            pt = getattr(part, "text", None)
            if pt:
                text += str(pt)
    if not text:
        try:
            if hasattr(response, "text"):
                text = (response.text or "").strip()
        except (ValueError, AttributeError):
            pass
    if not text:
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                pt = getattr(part, "text", None)
                if pt:
                    text += str(pt)
            if text:
                break
    return (text or "").strip()


def _call_gemini(prompt: str) -> Optional[Dict[str, str]]:
    if not GEMINI_API_KEY:
        print("[morning-gemini] GEMINI_API_KEY 없음, 건너뜀")
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = _extract_text_from_gemini_response(response)

        # JSON 파싱 (코드블록 감싸진 경우 제거)
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
        return {
            "us_market":    str(data.get("us_market", "") or "").strip(),
            "kr_indices":   str(data.get("kr_indices", "") or "").strip(),
            "exchange_rate": str(data.get("exchange_rate", "") or "").strip(),
            "kr_focus":     str(data.get("kr_focus", "") or "").strip(),
        }
    except Exception as e:
        print(f"[morning-gemini] Gemini 호출 오류: {e}")
        return None


def generate_and_save_ai_summary(
    db: Session,
    indices: list[dict],
    exchange_rates: list[dict],
    target_date: date,
) -> bool:
    """
    지수·환율 데이터를 Gemini로 전달해 AI 요약을 생성하고 DB에 저장(upsert)한다.

    Returns:
        True if saved, False on failure
    """
    prompt = _build_prompt(indices, exchange_rates)
    result = _call_gemini(prompt)
    if not result:
        return False

    existing = db.query(MarketMorningAiSummary).filter(
        MarketMorningAiSummary.date == target_date
    ).first()

    if existing:
        existing.us_market = result["us_market"]
        existing.kr_indices = result["kr_indices"]
        existing.exchange_rate = result["exchange_rate"]
        existing.kr_focus = result["kr_focus"]
    else:
        db.add(MarketMorningAiSummary(
            date=target_date,
            us_market=result["us_market"],
            kr_indices=result["kr_indices"],
            exchange_rate=result["exchange_rate"],
            kr_focus=result["kr_focus"],
        ))
    db.commit()
    print(f"[morning-gemini] AI 요약 저장 완료 ({target_date})")
    return True
