"""
오늘의 띠/별자리 운세 Gemini AI 생성 서비스

매일 01:00 KST 스케줄러가 띠 12개 + 별자리 12개 운세를 생성하여
daily_fortunes 테이블에 upsert한다.
"""
import json
import re
from datetime import datetime, date
from typing import Optional

import pytz
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.database import SessionLocal
from app.engine.models import DailyFortune

KST = pytz.timezone("Asia/Seoul")

ZODIAC_ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]
ZODIAC_SIGNS = [
    "양자리", "황소자리", "쌍둥이자리", "게자리", "사자자리", "처녀자리",
    "천칭자리", "전갈자리", "사수자리", "염소자리", "물병자리", "물고기자리",
]


def _today_kst() -> date:
    return datetime.now(KST).date()


def _call_gemini(prompt: str) -> str:
    """Gemini API 호출 → 텍스트 반환"""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        # 텍스트 추출
        if hasattr(response, "text"):
            return response.text or ""
        parts = getattr(response, "parts", [])
        texts = []
        for part in parts:
            if hasattr(part, "text") and part.text:
                texts.append(part.text)
        return "".join(texts)
    except Exception as e:
        print(f"❌ Gemini 호출 오류: {e}")
        return ""


def _extract_json_array(text: str) -> list:
    """텍스트에서 JSON 배열 추출 (Gemini 응답 래퍼 제거)"""
    try:
        # 직접 파싱 시도
        return json.loads(text.strip())
    except Exception:
        pass
    # 정규식으로 배열 부분만 추출
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return []


def _build_animal_prompt(date_str: str) -> str:
    return f"""오늘 {date_str} 한국 12띠별 투자 운세를 작성해주세요.
각 띠의 오늘 흐름을 재미있고 가볍게, 투자 분위기가 자연스럽게 녹아들도록 작성합니다.

반드시 아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트, 마크다운, 코드블록 없이):
[
  {{"animal": "쥐", "fortune": "오늘 운세 2~3문장. 재물·투자 흐름 자연스럽게 포함.", "investment_tip": "오늘 투자 포인트 1문장"}},
  ...
]

작성 규칙:
- fortune: 일상 운세 + 재물/투자 분위기 2~3문장 (각 띠 특성 반영)
- investment_tip: 구체적 투자 행동 또는 주의사항 1문장
- 12띠 모두 포함 필수: 쥐, 소, 호랑이, 토끼, 용, 뱀, 말, 양, 원숭이, 닭, 개, 돼지
- 순수 JSON 배열만 출력"""


def _build_sign_prompt(date_str: str) -> str:
    return f"""오늘 {date_str} 서양 12별자리별 투자 운세를 작성해주세요.
각 별자리의 오늘 흐름을 재미있고 가볍게, 투자 맥락이 자연스럽게 녹아들도록 작성합니다.

반드시 아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트, 마크다운, 코드블록 없이):
[
  {{"sign": "양자리", "fortune": "오늘 운세 2~3문장. 별자리 특성 + 투자 기운 포함.", "investment_tip": "오늘 투자 포인트 1문장"}},
  ...
]

작성 규칙:
- fortune: 별자리 고유 특성 반영 + 오늘의 투자 흐름 2~3문장
- investment_tip: 오늘 투자 행동 지침 1문장
- 12별자리 모두 포함: 양자리, 황소자리, 쌍둥이자리, 게자리, 사자자리, 처녀자리,
                      천칭자리, 전갈자리, 사수자리, 염소자리, 물병자리, 물고기자리
- 순수 JSON 배열만 출력"""


def _upsert_fortunes(db: Session, fortune_date: date, fortune_type: str, items: list) -> int:
    """daily_fortunes 테이블에 upsert. 저장된 행 수 반환."""
    key_field = "animal" if fortune_type == "animal" else "sign"
    saved = 0
    for item in items:
        key = item.get(key_field, "").strip()
        fortune_text = item.get("fortune", "").strip()
        investment_tip = item.get("investment_tip", "").strip() or None
        if not key or not fortune_text:
            continue
        stmt = (
            pg_insert(DailyFortune)
            .values(
                fortune_date=fortune_date,
                fortune_type=fortune_type,
                key=key,
                fortune_text=fortune_text,
                investment_tip=investment_tip,
            )
            .on_conflict_do_update(
                constraint="uq_daily_fortune",
                set_={"fortune_text": fortune_text, "investment_tip": investment_tip},
            )
        )
        db.execute(stmt)
        saved += 1
    if saved:
        db.commit()
    return saved


def generate_daily_fortunes(target_date: Optional[date] = None) -> dict:
    """
    띠 12개 + 별자리 12개 운세를 Gemini로 생성하여 DB에 저장.
    이미 오늘 데이터가 24개 모두 있으면 스킵.
    """
    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY 없음 — 운세 생성 스킵")
        return {"skipped": True, "reason": "no_api_key"}

    today = target_date or _today_kst()
    date_str = today.strftime("%Y년 %m월 %d일")
    result = {"date": today.isoformat(), "animal_saved": 0, "sign_saved": 0, "skipped": False}

    db: Session = SessionLocal()
    try:
        existing_count = (
            db.query(DailyFortune)
            .filter(DailyFortune.fortune_date == today)
            .count()
        )
        if existing_count >= 24:
            print(f"ℹ️ {today} 운세 이미 {existing_count}개 존재 — 스킵")
            result["skipped"] = True
            return result

        # 띠 운세 생성
        print(f"🔮 {date_str} 띠 운세 생성 중...")
        animal_raw = _call_gemini(_build_animal_prompt(date_str))
        animal_items = _extract_json_array(animal_raw)
        if animal_items:
            result["animal_saved"] = _upsert_fortunes(db, today, "animal", animal_items)
            print(f"✅ 띠 운세 {result['animal_saved']}개 저장")
        else:
            print("❌ 띠 운세 JSON 파싱 실패")

        # 별자리 운세 생성
        print(f"🔮 {date_str} 별자리 운세 생성 중...")
        sign_raw = _call_gemini(_build_sign_prompt(date_str))
        sign_items = _extract_json_array(sign_raw)
        if sign_items:
            result["sign_saved"] = _upsert_fortunes(db, today, "sign", sign_items)
            print(f"✅ 별자리 운세 {result['sign_saved']}개 저장")
        else:
            print("❌ 별자리 운세 JSON 파싱 실패")

        return result
    except Exception as e:
        print(f"❌ 운세 생성 오류: {e}")
        db.rollback()
        return {**result, "error": str(e)}
    finally:
        db.close()


def get_today_fortune(fortune_type: str, key: str) -> Optional[dict]:
    """
    오늘의 운세 조회. DB에 없으면 실시간 생성 후 반환.
    fortune_type: "animal" | "sign"
    key: "쥐" | "양자리" 등
    """
    today = _today_kst()
    db: Session = SessionLocal()
    try:
        row = (
            db.query(DailyFortune)
            .filter(
                DailyFortune.fortune_date == today,
                DailyFortune.fortune_type == fortune_type,
                DailyFortune.key == key,
            )
            .first()
        )
        if row:
            return {
                "fortune_text": row.fortune_text,
                "investment_tip": row.investment_tip,
                "fortune_date": row.fortune_date.isoformat(),
                "key": row.key,
                "fortune_type": row.fortune_type,
            }

        # DB에 없으면 전체 배치 생성 후 재조회
        print(f"⚠️ {today} {fortune_type}/{key} 운세 없음 — 실시간 생성")
        generate_daily_fortunes(today)
        db.expire_all()  # 다른 세션이 커밋한 데이터 반영

        row = (
            db.query(DailyFortune)
            .filter(
                DailyFortune.fortune_date == today,
                DailyFortune.fortune_type == fortune_type,
                DailyFortune.key == key,
            )
            .first()
        )
        if row:
            return {
                "fortune_text": row.fortune_text,
                "investment_tip": row.investment_tip,
                "fortune_date": row.fortune_date.isoformat(),
                "key": row.key,
                "fortune_type": row.fortune_type,
            }
        return None
    finally:
        db.close()
