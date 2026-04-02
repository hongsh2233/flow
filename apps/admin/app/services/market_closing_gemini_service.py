"""
장마감 시황 Gemini AI 처리 서비스

KR 지수(domestic_index_snapshots 네이버 우선, Yahoo 폴백)·환율·뉴스·이슈 AI요약을 Gemini에 전달하고
구조화된 시황 문장을 생성해 board/B001에 Post로 등록한다(pending 상태).

수급 본문은 `supply_summary_ai_summaries`(앱 수급 카드와 동일)의 코스피·코스닥 ai_summary만 1회 노출한다.
investor_day 표·deal_rank 표는 마감시황에서 제외(표 파싱 오류·중복 방지).

Gemini 응답 JSON 필드:
  - summary:        시장 총평 (코스피/코스닥 등락 요약)
  - exchange_rate:  환율 현황
  - today_highlight: 오늘 특징 (업종/테마/상한가)
  - tomorrow_focus: 내일 주목할 점
"""
import html
import json
import re
from datetime import date, datetime
from typing import Optional, Dict, List

import pytz
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.services.gemini_response_utils import (
    extract_first_json_object,
    extract_text_from_generate_content_response,
)
from app.engine.models import (
    YahooIndexDaily,
    YahooIndexSnapshot,
    ExchangeRateSnapshot,
    NaverSupplyData,
    FscRisingStock,
    NaverStockNews,
    Post,
    BoardCategory,
    SupplySummaryAi,
)


# ──────────────────────────────────────────────
# 데이터 수집 헬퍼
# ──────────────────────────────────────────────

def _get_kr_indices_from_domestic(db: Session, target_date: date) -> List[dict]:
    """당일(KST) domestic_index_snapshots(네이버) 최신 배치. 메인 웹·마감 시황과 동일 소스."""
    from app.services.domestic_index_service import get_kr_indices_dicts_from_domestic_db

    return get_kr_indices_dicts_from_domestic_db(db, target_date)


def _get_kr_indices_from_snapshots(db: Session, target_date: date) -> List[dict]:
    """국내 지수: 당일(KST) YahooIndexSnapshot 최신 배치 (^KS11, ^KQ11). 네이버 스냅 없을 때 폴백."""
    symbols = ["^KS11", "^KQ11"]
    latest_at = (
        db.query(func.max(YahooIndexSnapshot.collected_at))
        .filter(
            YahooIndexSnapshot.group == "kr",
            YahooIndexSnapshot.collected_date == target_date,
            YahooIndexSnapshot.symbol.in_(symbols),
        )
        .scalar()
    )
    if not latest_at:
        return []
    rows = (
        db.query(YahooIndexSnapshot)
        .filter(
            YahooIndexSnapshot.group == "kr",
            YahooIndexSnapshot.collected_date == target_date,
            YahooIndexSnapshot.collected_at == latest_at,
            YahooIndexSnapshot.symbol.in_(symbols),
        )
        .all()
    )
    out = []
    for r in rows:
        if r.price is None or r.change is None or r.change_percent is None:
            continue
        out.append(
            {
                "name": r.name,
                "symbol": r.symbol,
                "price": round(r.price or 0, 2),
                "change": round(r.change or 0, 2),
                "change_percent": round(r.change_percent or 0, 2),
            }
        )
    return out


def _get_kr_indices_from_daily(db: Session, target_date: date) -> List[dict]:
    """YahooIndexDaily 당일 행만 (스냅샷 없을 때)."""
    rows = db.query(YahooIndexDaily).filter(
        YahooIndexDaily.date == target_date,
        YahooIndexDaily.group == "kr",
        YahooIndexDaily.symbol.in_(["^KS11", "^KQ11"]),
    ).all()

    if not rows:
        print(f"[closing-gemini] {target_date} KR 지수(YahooIndexDaily) 없음")

    return [
        {
            "name": r.name,
            "symbol": r.symbol,
            "price": round(r.price or 0, 2),
            "change": round(r.change or 0, 2),
            "change_percent": round(r.change_percent or 0, 2),
        }
        for r in rows if r.price is not None
    ]


def _get_kr_indices(db: Session, target_date: date) -> List[dict]:
    """DB: 심볼별로 domestic_index_snapshots(네이버) → Yahoo 스냅 → Yahoo 일별."""
    syms = ["^KS11", "^KQ11"]
    domestic = _get_kr_indices_from_domestic(db, target_date)
    dom_by = {d["symbol"]: d for d in domestic}
    if len(domestic) >= 2:
        return sorted(domestic, key=lambda x: (0 if x["symbol"] == "^KS11" else 1))

    snap = _get_kr_indices_from_snapshots(db, target_date)
    snap_by = {d["symbol"]: d for d in snap}
    merged: List[dict] = []
    for sym in syms:
        row = dom_by.get(sym) or snap_by.get(sym)
        if row:
            merged.append(row)
    if len(merged) >= 2:
        return sorted(merged, key=lambda x: (0 if x["symbol"] == "^KS11" else 1))

    daily = _get_kr_indices_from_daily(db, target_date)
    daily_by = {d["symbol"]: d for d in daily}
    merged = []
    for sym in syms:
        row = dom_by.get(sym) or snap_by.get(sym) or daily_by.get(sym)
        if row:
            merged.append(row)

    if len(merged) < 2:
        if len(domestic) == 1:
            print("[closing-gemini] 네이버 국내지수 일부만 있음(1건) → Yahoo로 보완")
        elif snap and len(snap) < 2:
            print(f"[closing-gemini] KR 스냅샷 일부만 있음({len(snap)}건) → Daily와 병합 시도")

    return sorted(merged, key=lambda x: (0 if x["symbol"] == "^KS11" else 1))


def _resolve_naver_bizdate(db: Session, target_date: date) -> str:
    """
    네이버 수급 investor_day 기준으로 유효 bizdate 선택.
    당일 행이 없으면(수집 전·휴장 등) target 이하 최신 bizdate 사용.
    """
    primary = target_date.strftime("%Y%m%d")
    hit = (
        db.query(NaverSupplyData.id)
        .filter(
            NaverSupplyData.data_type == "investor_day",
            NaverSupplyData.market == "kospi",
            NaverSupplyData.bizdate == primary,
        )
        .first()
    )
    if hit:
        return primary
    latest = (
        db.query(func.max(NaverSupplyData.bizdate))
        .filter(
            NaverSupplyData.data_type == "investor_day",
            NaverSupplyData.market == "kospi",
            NaverSupplyData.bizdate <= primary,
        )
        .scalar()
    )
    if latest and latest != primary:
        print(f"[closing-gemini] investor_day 없음 bizdate={primary} → {latest} 사용")
    return latest or primary


def _get_exchange_rate(db: Session) -> List[dict]:
    """가장 최근 환율 스냅샷 조회"""
    latest = db.query(func.max(ExchangeRateSnapshot.collected_at)).scalar()
    if not latest:
        return []
    rows = db.query(ExchangeRateSnapshot).filter(
        ExchangeRateSnapshot.collected_at == latest,
    ).all()
    name_map = {"USD": "USD/KRW", "JPY": "JPY/KRW (100엔)", "EUR": "EUR/KRW"}
    return [
        {
            "currency": name_map.get(r.currency, r.currency),
            "rate": round(r.rate, 2),
            "change": round(r.change_val, 2),
        }
        for r in rows
    ]


def _get_latest_supply_ai_summaries(db: Session, bizdate: str) -> Dict[str, str]:
    """supply_summary_ai_summaries: 시장별 당일 collected_time 최신 ai_summary (앱 수급 요약과 동일 소스)."""
    out: Dict[str, str] = {}
    for market in ("kospi", "kosdaq"):
        row = (
            db.query(SupplySummaryAi)
            .filter(
                SupplySummaryAi.bizdate == bizdate,
                SupplySummaryAi.market == market,
                SupplySummaryAi.ai_summary.isnot(None),
                SupplySummaryAi.ai_summary != "",
            )
            .order_by(SupplySummaryAi.collected_time.desc())
            .first()
        )
        if row and (row.ai_summary or "").strip():
            out[market] = (row.ai_summary or "").strip()
    return out


def _get_upper_limit_stocks(db: Session, bizdate: str) -> List[str]:
    """FscRisingStock에서 상한가(≥29%) 종목 목록 반환 (최대 10개)"""
    rows = db.query(FscRisingStock).filter(
        FscRisingStock.bas_dt == bizdate,
    ).all()
    upper = []
    for r in rows:
        try:
            if float(r.flt_rt or 0) >= 29.0:
                upper.append(r.itms_nm or r.srtn_cd)
        except (ValueError, TypeError):
            pass
    return upper[:10]


def _get_top_news(db: Session, target_date: date) -> List[dict]:
    """오늘 발행된 NaverStockNews 중 최신 2건"""
    kst = pytz.timezone("Asia/Seoul")
    start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=kst)
    rows = (
        db.query(NaverStockNews)
        .filter(NaverStockNews.pub_datetime >= start)
        .order_by(NaverStockNews.pub_datetime.desc())
        .limit(2)
        .all()
    )
    return [
        {
            "title": r.title,
            "description": (r.description or "")[:200],
            "category": r.category,
        }
        for r in rows
    ]


def _get_investor_summary(db: Session, bizdate: str) -> Dict[str, dict]:
    """NaverSupplyData investor_day에서 오늘 투자자별 매매동향 (코스피/코스닥) 조회.
    반환: {"kospi": {"개인": "...", "외국인": "...", "기관계": "..."}, "kosdaq": {...}}
    """
    result: Dict[str, dict] = {}
    for market in ["kospi", "kosdaq"]:
        row = (
            db.query(NaverSupplyData)
            .filter(
                NaverSupplyData.data_type == "investor_day",
                NaverSupplyData.market == market,
                NaverSupplyData.bizdate == bizdate,
            )
            .order_by(NaverSupplyData.collected_at.desc())
            .first()
        )
        if not row or not row.data_json:
            result[market] = {}
            continue
        try:
            data = json.loads(row.data_json)
            headers = [str(h).replace("\xa0", " ").strip() for h in data.get("headers", [])]
            rows = data.get("rows", [])
            if not rows:
                result[market] = {}
                continue
            row0 = [str(c).replace("\xa0", " ").strip() for c in rows[0]]
            result[market] = dict(zip(headers, row0))
        except Exception:
            result[market] = {}
    return result


def _get_issue_summary(db: Session, target_date: date) -> Optional[str]:
    """daily_issue_summaries에서 오늘 이슈 AI요약 전체 조회 (여러 시간대 누적)"""
    try:
        from sqlalchemy import text
        rows = db.execute(
            text("SELECT collected_time, summary FROM daily_issue_summaries WHERE date = :d ORDER BY collected_time"),
            {"d": target_date},
        ).fetchall()
        if not rows:
            return None
        parts = []
        for row in rows:
            t, s = row[0], row[1]
            if t:
                parts.append(f"[{t}]\n{s.strip()}")
            else:
                parts.append(s.strip())
        return "\n\n".join(parts)
    except Exception as e:
        print(f"[closing-gemini] 이슈 요약 조회 오류: {e}")
        return None


# ──────────────────────────────────────────────
# Gemini 프롬프트 생성
# ──────────────────────────────────────────────

def _build_prompt(
    kr_indices: List[dict],
    exchange_rates: List[dict],
    upper_limit: List[str],
    news: List[dict],
    issue_summary: Optional[str] = None,
    supply_ai_summaries: Optional[Dict[str, str]] = None,
) -> str:
    # ① 주가지수
    idx_lines = []
    for idx in kr_indices:
        sign = "+" if idx["change"] >= 0 else ""
        idx_lines.append(
            f"- {idx['name']}: {idx['price']:,.2f}P  {sign}{idx['change']:,.2f}P ({sign}{idx['change_percent']:.2f}%)"
        )
    idx_section = "\n".join(idx_lines) if idx_lines else "- 데이터 없음"

    # ② 환율
    ex_lines = []
    for ex in exchange_rates:
        sign = "+" if ex["change"] >= 0 else ""
        ex_lines.append(f"- {ex['currency']}: {ex['rate']:,.2f}원 ({sign}{ex['change']:.2f})")
    ex_section = "\n".join(ex_lines) if ex_lines else "- 데이터 없음"

    # ③ 수급 요약 (supply_summary_ai_summaries — 본문에 그대로 실릴 예정)
    sa = supply_ai_summaries or {}
    k_txt, d_txt = sa.get("kospi", ""), sa.get("kosdaq", "")
    if k_txt or d_txt:
        supply_section = (
            f"[코스피]\n{k_txt or '없음'}\n\n"
            f"[코스닥]\n{d_txt or '없음'}"
        )
    else:
        supply_section = "- 당일 수급 AI 요약 없음 (수급 수집·요약 스케줄 확인)"

    # ④ 상한가
    upper_section = ", ".join(upper_limit) if upper_limit else "없음"

    # ⑤ 핵심 뉴스
    news_lines = []
    for i, n in enumerate(news, 1):
        news_lines.append(f"{i}. [{n['category']}] {n['title']}")
        if n["description"]:
            news_lines.append(f"   {n['description']}")
    news_section = "\n".join(news_lines) if news_lines else "- 오늘 주요 뉴스 없음"

    # ⑥ 이슈 AI요약
    issue_section = issue_summary.strip() if issue_summary else "- 데이터 없음"

    return f"""다음은 오늘 한국 주식시장 장마감 데이터입니다.
한국 개인 주식 투자자를 위해 아래 JSON 형식으로 장마감 시황 코멘트를 작성해주세요.

[주가지수]
{idx_section}

[환율]
{ex_section}

[수급 요약 — 게시글 본문에 동일 문구가 포함되므로 아래를 요약·반복하지 말 것]
{supply_section}

[상한가 종목]
{upper_section}

[오늘 핵심 뉴스]
{news_section}

[오늘 이슈 AI요약]
{issue_section}

작성 규칙:
- 각 항목은 2~3문장, 자연스러운 한국어 문장
- 수치 변화(상승/하락)와 맥락을 함께 서술
- summary·exchange_rate·today_highlight·tomorrow_focus 어디에서도 외국인·개인·기관·프로그램 수급을 언급하지 말 것 (수급은 별도 섹션에만 게시)
- today_highlight 는 상한가 종목·업종·테마 특징만 (상한가 없으면 거래대금/변동성 등)
- tomorrow_focus 는 내일 주목할 이슈·지수 전망 (1~2문장)
- 절대 JSON 외 다른 텍스트나 마크다운 코드블록(```)을 포함하지 말 것

응답 형식 (반드시 이 JSON만 응답):
{{
  "summary": "시장 총평 (코스피·코스닥 등락 요약)",
  "exchange_rate": "환율 현황 (달러원 위주, 1문장)",
  "today_highlight": "오늘 특징 (업종·테마·상한가 종목 포함, 2~3문장)",
  "tomorrow_focus": "내일 주목할 점 (1~2문장)"
}}"""


# ──────────────────────────────────────────────
# Gemini 호출
# ──────────────────────────────────────────────

def _call_gemini(prompt: str) -> Optional[Dict[str, str]]:
    if not GEMINI_API_KEY:
        print("[closing-gemini] GEMINI_API_KEY 없음, 건너뜀")
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
            response, log_prefix="closing-gemini", log_if_empty=True
        )

        # 코드블록 제거 (위치 무관 - thinking 잔류 텍스트 뒤에 올 수 있으므로 앵커 없이)
        text = re.sub(r"```(?:json)?\s*", "", text)
        text = re.sub(r"```", "", text)
        json_blob = extract_first_json_object(text)
        if not json_blob:
            print(f"[closing-gemini] JSON 블록 추출 실패, 원문(첫 400자): {text[:400]!r}")
            return None
        data = json.loads(json_blob)
        return {
            "summary":          str(data.get("summary", "") or "").strip(),
            "exchange_rate":    str(data.get("exchange_rate", "") or "").strip(),
            "today_highlight":  str(data.get("today_highlight", "") or "").strip(),
            "tomorrow_focus":   str(data.get("tomorrow_focus", "") or "").strip(),
        }
    except Exception as e:
        print(f"[closing-gemini] Gemini 호출 오류: {e}")
        print(f"[closing-gemini] 응답 텍스트(첫 300자): {text[:300]!r}")
        return None


# ──────────────────────────────────────────────
# Post 내용 조립 (HTML)
# ──────────────────────────────────────────────

def _build_supply_ai_section_html(summaries: Dict[str, str]) -> str:
    """supply_summary_ai_summaries 텍스트만 출력 (앱 수급 카드와 동일 DB)."""
    if not summaries:
        return (
            "<p>당일 수급 AI 요약이 없습니다. 장중 수급 수집·요약 스케줄(예: 16:10) 이후 "
            "<code>supply_summary_ai_summaries</code> 저장 여부를 확인하세요.</p>\n"
        )
    blocks = []
    for mkt_key, label in (("kospi", "코스피"), ("kosdaq", "코스닥")):
        text = (summaries.get(mkt_key) or "").strip()
        if not text:
            continue
        safe = html.escape(text).replace("\n", "<br/>\n")
        blocks.append(f"<p><strong>[{label}]</strong></p>\n<p>{safe}</p>\n")
    if not blocks:
        return (
            "<p>당일 수급 AI 요약이 없습니다. 수급 수집·요약 스케줄을 확인하세요.</p>\n"
        )
    return "".join(blocks)


def _build_post_content(
    kr_indices: List[dict],
    exchange_rates: List[dict],
    news: List[dict],
    ai: Dict[str, str],
    upper_limit: List[str],
    issue_summary: Optional[str] = None,
    supply_ai_summaries: Optional[Dict[str, str]] = None,
) -> str:
    # ① 주가지수 HTML
    idx_html = ""
    for idx in kr_indices:
        sign = "+" if idx["change"] >= 0 else ""
        color = "#e53935" if idx["change"] >= 0 else "#1565c0"
        idx_html += (
            f'<p>• {idx["name"]} '
            f'<strong style="color:{color}">'
            f'{idx["price"]:,.2f}P '
            f'{sign}{idx["change"]:,.2f}P ({sign}{idx["change_percent"]:.2f}%)'
            f'</strong></p>\n'
        )

    # ② 핵심 뉴스 HTML
    news_html = ""
    for i, n in enumerate(news, 1):
        news_html += f'<p>{i}. <strong>[{n["category"]}]</strong> {n["title"]}</p>\n'
        if n["description"]:
            news_html += f'<p style="margin-left:16px;color:#555;">{n["description"]}</p>\n'
    if not news_html:
        news_html = "<p>오늘 주요 뉴스 없음</p>\n"

    supply_html = _build_supply_ai_section_html(supply_ai_summaries or {})

    # 상한가
    upper_html = (
        f'<p>{", ".join(upper_limit)}</p>\n'
        if upper_limit
        else "<p>상한가 종목 없음</p>\n"
    )

    # 환율 (가장 주요한 USD/KRW만 1줄)
    usd = next((e for e in exchange_rates if "USD" in e["currency"]), None)
    ex_str = ""
    if usd:
        sign = "+" if usd["change"] >= 0 else ""
        ex_str = f'{usd["rate"]:,.2f}원 ({sign}{usd["change"]:.2f})'

    # 이슈 AI요약 HTML
    issue_html = f'<p>{issue_summary.strip()}</p>\n' if issue_summary else "<p>데이터 없음</p>\n"

    content = f"""<div class="market-closing-summary">
<h3>① 주가지수</h3>
{idx_html}
<h3>② 오늘 이슈 AI요약</h3>
{issue_html}
<h3>③ 핵심 뉴스</h3>
{news_html}
<h3>④ 시장 총평</h3>
<p>{ai.get("summary", "")}</p>

<h3>⑤ 환율</h3>
<p>USD/KRW {ex_str}</p>
<p>{ai.get("exchange_rate", "")}</p>

<h3>⑥ 수급 요약 (수급 AI·DB, 앱과 동일)</h3>
{supply_html}
<h3>⑦ 오늘 특징 (상한가·업종·테마)</h3>
{upper_html}<p>{ai.get("today_highlight", "")}</p>

<h3>⑧ 내일 주목할 점</h3>
<p>{ai.get("tomorrow_focus", "")}</p>

<p style="margin-top:24px;font-size:12px;color:#999;">※ 본 시황은 AI가 자동 생성한 콘텐츠로, 데이터 수집 시점의 차이로 인해 실제 수치와 약간의 오차가 있을 수 있습니다. 투자 판단의 참고 자료로만 활용하시기 바랍니다.</p>
</div>"""
    return content


# ──────────────────────────────────────────────
# 메인 진입점
# ──────────────────────────────────────────────

def _make_closing_title(target_date: date, investor_summary: Dict[str, dict]) -> str:
    """
    제목 예시: 외국인 3,211억 순매도, 개인 8,432억 순매수, 기관 4,987억 순매도 | 2026년 3월 12일 마감시황
    코스피 investor_day 데이터 기준. 데이터 없으면 기본 형식 사용.
    """
    date_str = f"{target_date.year}년 {target_date.month}월 {target_date.day}일 마감시황"
    inv = investor_summary.get("kospi", {})
    if not inv:
        return date_str

    parts = []
    for label, key in [("외국인", "외국인"), ("개인", "개인"), ("기관", "기관계")]:
        raw = inv.get(key, "")
        try:
            num = int(str(raw).replace(",", "").replace("+", ""))
            direction = "순매수" if num > 0 else "순매도"
            parts.append(f"{label} {abs(num):,}억 {direction}")
        except (ValueError, TypeError):
            pass

    if not parts:
        return date_str
    return f"{', '.join(parts)} | {date_str}"


def generate_and_post_closing_summary(db: Session, target_date: date) -> bool:
    """
    장마감 시황을 Gemini로 생성하고 board/B001에 Post로 등록(upsert)한다.

    Returns:
        True if saved, False on failure
    """
    bizdate = _resolve_naver_bizdate(db, target_date)

    # 데이터 수집
    kr_indices       = _get_kr_indices(db, target_date)
    exchange_rates   = _get_exchange_rate(db)
    investor_summary = _get_investor_summary(db, bizdate)
    supply_ai        = _get_latest_supply_ai_summaries(db, bizdate)
    upper_limit      = _get_upper_limit_stocks(db, bizdate)
    news             = _get_top_news(db, target_date)
    issue_summary    = _get_issue_summary(db, target_date)

    if not kr_indices:
        print("[closing-gemini] KR 지수 데이터 없음, 건너뜀")
        return False

    if issue_summary:
        print(f"[closing-gemini] 이슈 AI요약 포함 ({len(issue_summary)}자)")
    else:
        print("[closing-gemini] 이슈 AI요약 없음 (건너뜀)")

    if supply_ai:
        print(f"[closing-gemini] 수급 AI요약 포함 (kospi={bool(supply_ai.get('kospi'))}, kosdaq={bool(supply_ai.get('kosdaq'))})")
    else:
        print("[closing-gemini] 수급 AI요약 없음 — supply_summary_ai_summaries 확인 (장중 수급 요약 스케줄)")

    # Gemini 호출
    prompt = _build_prompt(kr_indices, exchange_rates, upper_limit, news, issue_summary, supply_ai)
    ai = _call_gemini(prompt)
    if not ai:
        return False

    # 제목 생성 (investor_day 코스피 — 제목 줄만)
    title = _make_closing_title(target_date, investor_summary)

    # 게시글 내용 조립
    content = _build_post_content(
        kr_indices, exchange_rates, news, ai, upper_limit, issue_summary, supply_ai
    )

    # "시황" 카테고리 ID 조회
    category_id = None
    try:
        cat = (
            db.query(BoardCategory)
            .filter(BoardCategory.board_id == "B001", BoardCategory.name == "시황")
            .first()
        )
        if cat:
            category_id = cat.id
            print(f"[closing-gemini] 시황 카테고리 ID: {category_id}")
        else:
            print("[closing-gemini] 시황 카테고리 없음 (category_id=None으로 등록)")
    except Exception as e:
        print(f"[closing-gemini] 카테고리 조회 오류: {e}")

    # B001 게시판에 upsert: 날짜 기준으로 조회 (제목 숫자가 달라도 당일 재실행 시 덮어씀)
    date_keyword = f"{target_date.year}년 {target_date.month}월 {target_date.day}일 마감시황"
    existing = (
        db.query(Post)
        .filter(Post.board_id == "B001", Post.title.like(f"%{date_keyword}%"))
        .first()
    )
    kst = pytz.timezone("Asia/Seoul")
    now_kst = datetime.now(kst)
    if existing:
        existing.title = title
        existing.content = content
        if category_id is not None:
            existing.category_id = category_id
        existing.updated_at = now_kst
        existing.created_at = now_kst
    else:
        db.add(
            Post(
                board_id="B001",
                title=title,
                content=content,
                author="플로우Ai",
                status="pending",
                category_id=category_id,
                created_at=now_kst,
                updated_at=now_kst,
            )
        )
    db.commit()
    print(f"[closing-gemini] 장마감 시황 게시 완료 ({target_date}, category_id={category_id})")
    return True
