"""
수급 동향 Gemini AI 요약 서비스

investor_time, program_time 수집 데이터(코스피·코스닥 각각)를 Gemini에 전달해
자연스러운 한국어로 수급 상황 요약을 생성·저장한다.
"""
import json
from typing import Optional

from sqlalchemy.orm import Session

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.models import NaverSupplyData
from app.engine.models import SupplySummaryAi

MARKET_KOSPI = "kospi"
MARKET_KOSDAQ = "kosdaq"
MARKET_LABEL = {MARKET_KOSPI: "코스피", MARKET_KOSDAQ: "코스닥"}


def _parse_num(v) -> int:
    if isinstance(v, (int, float)):
        return int(v)
    if not v:
        return 0
    s = str(v).replace(",", "").replace("+", "").strip()
    try:
        return int(s) if s and s != "-" else 0
    except ValueError:
        return 0


def _find_col_idx(headers: list, keywords: list, excludes: list = None) -> int:
    excludes = excludes or []
    for i, h in enumerate(headers):
        norm = (h or "").replace(" ", "")
        if any(k in norm for k in keywords) and not any(e in norm for e in excludes):
            return i
    return -1


def _get_supply_numbers(
    db: Session, bizdate: str, collected_time: str, market: str
) -> Optional[dict]:
    """investor_time + program_time에서 해당 시장 마지막 행 수치 추출. 원본 없으면 None."""
    result = {
        "foreign": 0,
        "individual": 0,
        "institution": 0,
        "program_arbitrage": 0,
        "program_non_arbitrage": 0,
    }
    found_any = False

    for data_type in ("investor_time", "program_time"):
        row = (
            db.query(NaverSupplyData)
            .filter(
                NaverSupplyData.data_type == data_type,
                NaverSupplyData.market == market,
                NaverSupplyData.sub_key.is_(None),
                NaverSupplyData.bizdate == bizdate,
                NaverSupplyData.collected_time == collected_time,
            )
            .order_by(NaverSupplyData.collected_at.desc())
            .first()
        )
        # 시장별 URL이 차단/빈 응답이면 "all" 데이터로 폴백
        if not row or not row.data_json:
            row = (
                db.query(NaverSupplyData)
                .filter(
                    NaverSupplyData.data_type == data_type,
                    NaverSupplyData.market == "all",
                    NaverSupplyData.sub_key.is_(None),
                    NaverSupplyData.bizdate == bizdate,
                    NaverSupplyData.collected_time == collected_time,
                )
                .order_by(NaverSupplyData.collected_at.desc())
                .first()
            )
        if not row or not row.data_json:
            continue
        found_any = True
        try:
            data = json.loads(row.data_json)
            headers = data.get("headers") or []
            rows = data.get("rows") or []
            if not rows:
                continue
            last_row = rows[-1]

            if data_type == "investor_time":
                idx_i = _find_col_idx(headers, ["개인"], ["기타"])
                idx_f = _find_col_idx(headers, ["외국인계", "외국인"], ["기타외국인"])
                idx_inst = _find_col_idx(headers, ["기관계", "기관"])
                if idx_i >= 0 and idx_i < len(last_row):
                    result["individual"] = _parse_num(last_row[idx_i])
                if idx_f >= 0 and idx_f < len(last_row):
                    result["foreign"] = _parse_num(last_row[idx_f])
                if idx_inst >= 0 and idx_inst < len(last_row):
                    result["institution"] = _parse_num(last_row[idx_inst])

            elif data_type == "program_time":
                arb_col = next(
                    (
                        i
                        for i, h in enumerate(headers)
                        if "차익" in (h or "").replace(" ", "")
                        and "순매수" in (h or "").replace(" ", "")
                        and "비차익" not in (h or "")
                    ),
                    -1,
                )
                non_arb_col = next(
                    (
                        i
                        for i, h in enumerate(headers)
                        if "비차익" in (h or "").replace(" ", "")
                        and "순매수" in (h or "").replace(" ", "")
                    ),
                    -1,
                )
                if arb_col >= 0 and arb_col < len(last_row):
                    result["program_arbitrage"] = _parse_num(last_row[arb_col])
                elif len(headers) >= 4:
                    result["program_arbitrage"] = _parse_num(last_row[3])
                if non_arb_col >= 0 and non_arb_col < len(last_row):
                    result["program_non_arbitrage"] = _parse_num(last_row[non_arb_col])
                elif len(headers) >= 7:
                    result["program_non_arbitrage"] = _parse_num(last_row[6])
        except Exception as e:
            print(f"[supply-gemini] 파싱 오류 {market} {data_type}: {e}")

    if not found_any:
        return None
    return result


def _build_prompt(nums: dict, time_label: str, market_key: str) -> str:
    market_ko = MARKET_LABEL.get(market_key, market_key)

    # 네이버 수급 데이터 단위: 백만원 (1억원 = 100백만, 1조원 = 1,000,000백만)
    # 앱 카드와 동일하게 조원·억원·백만원을 항상 붙여 혼동 방지
    def fmt_abs(abs_n: int) -> str:
        abs_n = int(abs(abs_n))
        if abs_n == 0:
            return "0원"
        if abs_n >= 1_000_000:
            jo = abs_n / 1_000_000
            if jo >= 10 or abs(jo - round(jo)) < 1e-6:
                text = f"{round(jo):,}"
            else:
                text = f"{jo:.1f}"
            return f"{text}조원"
        if abs_n >= 100:
            eok = abs_n / 100
            if abs(eok - round(eok)) < 1e-6 or abs(eok) >= 1000:
                text = f"{round(eok):,}"
            else:
                text = f"{round(eok * 10) / 10:g}"
            return f"{text}억원"
        return f"{abs_n:,}백만원"

    def signed(n: int) -> str:
        if n == 0:
            return "0원"
        body = fmt_abs(n)
        return f"+{body}" if n > 0 else f"-{body}"

    return f"""다음은 한국 증시 {market_ko} 수급 동향 데이터입니다. {time_label}

[투자주체별 순매수/순매도]
- 외국인: {signed(nums['foreign'])}
- 개인: {signed(nums['individual'])}
- 기관: {signed(nums['institution'])}

[프로그램매매]
- 차익거래 순매수: {signed(nums['program_arbitrage'])}
- 비차익거래 순매수: {signed(nums['program_non_arbitrage'])}

위 수치를 바탕으로 2~3문장으로 {market_ko} 수급 상황을 자연스러운 한국어로 요약해주세요.
- 외국인/개인/기관의 매매 동향과 프로그램매매 흐름을 간결히 설명
- 금액은 반드시 단위어를 붙이세요: 조원, 억원, 백만원 (예: 110억원, 1.2조원, 50백만원). "110억"처럼 원 단위를 생략하지 마세요.
- 마크다운, JSON, 코드블록 없이 순수 텍스트만 응답
- "현재", "기준" 등 시점 표현은 생략 가능
"""


def _extract_text_from_gemini_response(response) -> str:
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
    if not text:
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                if getattr(part, "thought", False):
                    continue
                pt = getattr(part, "text", None)
                if pt:
                    text += str(pt)
            if text:
                break
    return (text or "").strip()


def _call_gemini(prompt: str) -> Optional[str]:
    # [2026-08-03 Gemini 제거] 비용 절감 — 모든 Gemini 호출 차단
    return None
    if not GEMINI_API_KEY:
        print("[supply-gemini] GEMINI_API_KEY 없음, 건너뜀")
        return None
    try:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        text = _extract_text_from_gemini_response(response)
        return text or None
    except Exception as e:
        print(f"[supply-gemini] Gemini 호출 오류: {e}")
        return None


def _bizdate_to_ymd(bizdate: str) -> str:
    """영업일자를 제목·프롬프트용 YYYY-MM-DD로 통일 (예: 20260329 → 2026-03-29)."""
    s = (bizdate or "").replace("-", "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    raw = (bizdate or "").strip()
    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        return raw
    return bizdate or ""


def _time_label_for_collected_time(bizdate: str, collected_time: str) -> str:
    hour = int(collected_time.split(":")[0] or "0")
    minute = int(collected_time.split(":")[1] or "0")
    if hour >= 15 and (hour > 15 or minute >= 30):
        ymd = _bizdate_to_ymd(bizdate)
        return f"{ymd} 15:30분 정규장 마감 기준" if ymd else "금일 15:30분 정규장 마감 기준"
    prev_h = hour - 1 if hour > 0 else 23
    curr_h = hour
    prev_m = 30 if minute >= 30 else 0
    curr_m = 30 if minute >= 30 else 0
    return f"현재 {prev_h:02d}:{prev_m:02d}~{curr_h:02d}:{curr_m:02d} 기준"


# [2026-07-08 Gemini 제거] Phase 1-2 비용 절감을 위해 주석처리
# 재활성화 시 /docs/gemini-removal-migration-guide.md 참조
# def generate_and_save_supply_summary(db: Session, bizdate: str, collected_time: str) -> int:
#     """
#     코스피·코스닥 각각 investor_time + program_time을 Gemini로 요약해 저장.
#
#     Returns:
#         저장에 성공한 시장 수 (0~2)
#     """
#     if not GEMINI_API_KEY:
#         print("[supply-gemini] ❌ GEMINI_API_KEY 환경변수 없음 — AI 요약 건너뜀")
#         return 0
#
#     time_label = _time_label_for_collected_time(bizdate, collected_time)
#     saved = 0
#     print(f"[supply-gemini] 시작: {bizdate} {collected_time}")
#
#     for market in (MARKET_KOSPI, MARKET_KOSDAQ):
#         nums = _get_supply_numbers(db, bizdate, collected_time, market)
#         if nums is None:
#             print(f"[supply-gemini] ⚠️ {bizdate} {collected_time} {market} — DB에서 수급 원본 못 찾음, 건너뜀")
#             continue
#         print(f"[supply-gemini] {market} 수치: {nums}")
#
#         prompt = _build_prompt(nums, time_label, market)
#         summary = _call_gemini(prompt)
#         if not summary:
#             print(f"[supply-gemini] {market} Gemini 응답 없음")
#             continue
#
#         existing = (
#             db.query(SupplySummaryAi)
#             .filter(
#                 SupplySummaryAi.bizdate == bizdate,
#                 SupplySummaryAi.collected_time == collected_time,
#                 SupplySummaryAi.market == market,
#             )
#             .first()
#         )
#         if existing:
#             existing.ai_summary = summary
#         else:
#             db.add(
#                 SupplySummaryAi(
#                     bizdate=bizdate,
#                     collected_time=collected_time,
#                     market=market,
#                     ai_summary=summary,
#                 )
#             )
#         db.commit()
#         saved += 1
#         print(f"[supply-gemini] 수급 AI 요약 저장 완료 ({bizdate} {collected_time} {market})")
#
#     return saved
