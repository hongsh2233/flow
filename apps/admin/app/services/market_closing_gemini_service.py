"""
장마감 시황 Gemini AI 처리 서비스

15:40 수집된 KR지수·수급동향·뉴스 데이터 + 이슈 AI요약을 Gemini에 전달하고
구조화된 시황 문장을 생성해 board/B001에 Post로 등록한다(pending 상태).

Gemini 응답 JSON 필드:
  - summary:        시장 총평 (코스피/코스닥 등락 요약)
  - exchange_rate:  환율 현황
  - supply_trend:   외국인/기관 동향 (순매수·매도 대표 종목 포함)
  - today_highlight: 오늘 특징 (업종/테마/상한가)
  - tomorrow_focus: 내일 주목할 점
"""
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
    ExchangeRateSnapshot,
    NaverSupplyData,
    FscRisingStock,
    NaverStockNews,
    Post,
    BoardCategory,
)


# ──────────────────────────────────────────────
# 데이터 수집 헬퍼
# ──────────────────────────────────────────────

def _get_kr_indices(db: Session, target_date: date) -> List[dict]:
    """YahooIndexDaily에서 KR 지수 조회 (^KS11, ^KQ11).
    오늘 데이터가 없으면 가장 최근 수집된 날짜로 폴백."""
    # 1차: 오늘 날짜
    rows = db.query(YahooIndexDaily).filter(
        YahooIndexDaily.date == target_date,
        YahooIndexDaily.group == "kr",
        YahooIndexDaily.symbol.in_(["^KS11", "^KQ11"]),
    ).all()

    if not rows:
        # 폴백: 가장 최근 날짜의 KR 지수
        latest_date = (
            db.query(func.max(YahooIndexDaily.date))
            .filter(
                YahooIndexDaily.group == "kr",
                YahooIndexDaily.symbol.in_(["^KS11", "^KQ11"]),
            )
            .scalar()
        )
        if latest_date:
            print(f"[closing-gemini] 오늘({target_date}) KR지수 없음 → 최근 날짜({latest_date})로 폴백")
            rows = db.query(YahooIndexDaily).filter(
                YahooIndexDaily.date == latest_date,
                YahooIndexDaily.group == "kr",
                YahooIndexDaily.symbol.in_(["^KS11", "^KQ11"]),
            ).all()

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


def _get_deal_rank(db: Session, bizdate: str) -> Dict[str, List[str]]:
    """
    NaverSupplyData deal_rank 에서 외국인/기관 순매수·매도 상위 5종목 추출.
    bizdate: YYYYMMDD 문자열
    반환: {
        "foreign_buy_kospi": ["삼성전자", ...],
        "foreign_sell_kospi": [...],
        "inst_buy_kospi": [...],
        "inst_sell_kospi": [...],
        (kosdaq 동일)
    }
    """
    sub_keys = [
        ("kospi", "foreign_buy"),
        ("kospi", "foreign_sell"),
        ("kospi", "inst_buy"),
        ("kospi", "inst_sell"),
        ("kosdaq", "foreign_buy"),
        ("kosdaq", "foreign_sell"),
        ("kosdaq", "inst_buy"),
        ("kosdaq", "inst_sell"),
    ]
    result: Dict[str, List[str]] = {}

    for market, sub_key in sub_keys:
        # 해당 날짜의 가장 최근 수집본 사용
        row = (
            db.query(NaverSupplyData)
            .filter(
                NaverSupplyData.data_type == "deal_rank",
                NaverSupplyData.market == market,
                NaverSupplyData.sub_key == sub_key,
                NaverSupplyData.bizdate == bizdate,
            )
            .order_by(NaverSupplyData.collected_at.desc())
            .first()
        )
        key = f"{sub_key}_{market}"
        if not row or not row.data_json:
            result[key] = []
            continue
        try:
            data = json.loads(row.data_json)
            rows = data.get("rows", [])
            # col[0]=순위, col[1]=종목명
            names = [r[1] for r in rows[:5] if len(r) > 1]
            result[key] = names
        except Exception:
            result[key] = []

    return result


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
            headers = data.get("headers", [])
            rows = data.get("rows", [])
            # 첫 번째 행 = 오늘(가장 최근) 날짜 데이터
            result[market] = dict(zip(headers, rows[0])) if rows else {}
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
    deal_rank: Dict[str, List[str]],
    upper_limit: List[str],
    news: List[dict],
    issue_summary: Optional[str] = None,
    investor_summary: Optional[Dict[str, dict]] = None,
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

    # ③ 외국인/기관 동향
    def _rank_line(key: str, label: str) -> str:
        names = deal_rank.get(key, [])
        return f"- {label}: {', '.join(names) if names else '없음'}"

    supply_section = "\n".join([
        "[코스피]",
        _rank_line("foreign_buy_kospi",  "외국인 순매수"),
        _rank_line("foreign_sell_kospi", "외국인 순매도"),
        _rank_line("inst_buy_kospi",     "기관 순매수"),
        _rank_line("inst_sell_kospi",    "기관 순매도"),
        "[코스닥]",
        _rank_line("foreign_buy_kosdaq",  "외국인 순매수"),
        _rank_line("foreign_sell_kosdaq", "외국인 순매도"),
        _rank_line("inst_buy_kosdaq",     "기관 순매수"),
        _rank_line("inst_sell_kosdaq",    "기관 순매도"),
    ])

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

    # ⑦ 투자자별 매매동향 (개인/외국인/기관 합계)
    inv_lines = []
    key_cols = ["개인", "외국인", "기관계"]
    for mkt_label, mkt_key in [("코스피", "kospi"), ("코스닥", "kosdaq")]:
        inv = (investor_summary or {}).get(mkt_key, {})
        if inv:
            cols = ", ".join(f"{k}: {inv.get(k, '-')}" for k in key_cols if k in inv)
            inv_lines.append(f"- [{mkt_label}] {cols}")
    inv_section = "\n".join(inv_lines) if inv_lines else "- 데이터 없음"

    return f"""다음은 오늘 한국 주식시장 장마감 데이터입니다.
한국 개인 주식 투자자를 위해 아래 JSON 형식으로 장마감 시황 코멘트를 작성해주세요.

[주가지수]
{idx_section}

[환율]
{ex_section}

[외국인·기관 수급 동향]
{supply_section}

[상한가 종목]
{upper_section}

[오늘 핵심 뉴스]
{news_section}

[투자자별 매매동향 (개인/외국인/기관 합계, 단위: 억원)]
{inv_section}

[오늘 이슈 AI요약]
{issue_section}

작성 규칙:
- 각 항목은 2~3문장, 자연스러운 한국어 문장
- 수치 변화(상승/하락)와 맥락을 함께 서술
- supply_trend 는 외국인·기관의 수급 특징과 대표 종목을 1~2개 언급
- today_highlight 는 상한가 종목·업종·테마 특징을 설명 (상한가 없으면 거래대금/변동성 등 언급)
- tomorrow_focus 는 내일 주목해야 할 이슈나 지수 흐름 전망 (1~2문장)
- 절대 JSON 외 다른 텍스트나 마크다운 코드블록(```)을 포함하지 말 것

응답 형식 (반드시 이 JSON만 응답):
{{
  "summary": "시장 총평 (코스피·코스닥 등락 요약)",
  "exchange_rate": "환율 현황 (달러원 위주, 1문장)",
  "supply_trend": "외국인·기관 동향 (순매수·매도 대표 종목 포함, 2~3문장)",
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
            "supply_trend":     str(data.get("supply_trend", "") or "").strip(),
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

def _build_supply_html(deal_rank: Dict[str, List[str]], ai_comment: str) -> str:
    """외국인·기관 수급을 DB 원본 데이터로 직접 렌더링.
    AI(Gemini)는 순매수/순매도 종목 나열이 아닌 해석 코멘트만 보조로 사용."""
    html = ""
    markets = [
        ("코스피", "foreign_buy_kospi", "foreign_sell_kospi", "inst_buy_kospi", "inst_sell_kospi"),
        ("코스닥", "foreign_buy_kosdaq", "foreign_sell_kosdaq", "inst_buy_kosdaq", "inst_sell_kosdaq"),
    ]
    for market, fb, fs, ib, is_ in markets:
        fb_names = ", ".join(deal_rank.get(fb, [])) or "없음"
        fs_names = ", ".join(deal_rank.get(fs, [])) or "없음"
        ib_names = ", ".join(deal_rank.get(ib, [])) or "없음"
        is_names = ", ".join(deal_rank.get(is_, [])) or "없음"
        html += (
            f"<p><strong>[{market}]</strong></p>\n"
            f"<p>• 외국인 순매수: {fb_names}</p>\n"
            f"<p>• 외국인 순매도: {fs_names}</p>\n"
            f"<p>• 기관 순매수: {ib_names}</p>\n"
            f"<p>• 기관 순매도: {is_names}</p>\n"
        )
    if ai_comment:
        html += f'<p style="color:#555;margin-top:8px;">{ai_comment}</p>\n'
    return html


def _build_post_content(
    kr_indices: List[dict],
    exchange_rates: List[dict],
    news: List[dict],
    ai: Dict[str, str],
    upper_limit: List[str],
    deal_rank: Optional[Dict[str, List[str]]] = None,
    issue_summary: Optional[str] = None,
    investor_summary: Optional[Dict[str, dict]] = None,
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

    # ⑤ 외국인·기관 동향: DB 원본 데이터 직접 렌더링 (AI 오류 방지)
    supply_html = _build_supply_html(deal_rank or {}, ai.get("supply_trend", ""))

    # 투자자별 매매동향 HTML (개인/외국인/기관계)
    inv_html = ""
    key_cols = ["개인", "외국인", "기관계", "금융투자", "보험", "투신(사모)", "연기금등"]
    for mkt_label, mkt_key in [("코스피", "kospi"), ("코스닥", "kosdaq")]:
        inv = (investor_summary or {}).get(mkt_key, {})
        if inv:
            inv_html += f"<p><strong>[{mkt_label}]</strong></p>\n"
            for k in key_cols:
                if k in inv:
                    val = inv[k]
                    try:
                        num = int(str(val).replace(",", "").replace("+", ""))
                        color = "#e53935" if num > 0 else "#1565c0" if num < 0 else ""
                        style_str = f' style="color:{color}"' if color else ""
                        inv_html += f"<p>• {k}: <strong{style_str}>{val}</strong></p>\n"
                    except (ValueError, TypeError):
                        inv_html += f"<p>• {k}: {val}</p>\n"
    if not inv_html:
        inv_html = "<p>데이터 없음</p>\n"

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

<h3>⑥ 투자자별 매매동향</h3>
{inv_html}
<h3>⑦ 외국인·기관 수급 순위</h3>
{supply_html}
<h3>⑧ 오늘 특징 (상한가·업종·테마)</h3>
{upper_html}<p>{ai.get("today_highlight", "")}</p>

<h3>⑨ 내일 주목할 점</h3>
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
    bizdate = target_date.strftime("%Y%m%d")

    # 데이터 수집
    kr_indices       = _get_kr_indices(db, target_date)
    exchange_rates   = _get_exchange_rate(db)
    deal_rank        = _get_deal_rank(db, bizdate)
    investor_summary = _get_investor_summary(db, bizdate)
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

    # Gemini 호출
    prompt = _build_prompt(kr_indices, exchange_rates, deal_rank, upper_limit, news, issue_summary, investor_summary)
    ai = _call_gemini(prompt)
    if not ai:
        return False

    # 제목 생성 (investor_summary 수집 후)
    title = _make_closing_title(target_date, investor_summary)

    # 게시글 내용 조립
    content = _build_post_content(kr_indices, exchange_rates, news, ai, upper_limit, deal_rank, issue_summary, investor_summary)

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
    if existing:
        existing.title = title
        existing.content = content
        if category_id is not None:
            existing.category_id = category_id
    else:
        db.add(Post(
            board_id="B001",
            title=title,
            content=content,
            author="플로우Ai",
            status="pending",
            category_id=category_id,
        ))
    db.commit()
    print(f"[closing-gemini] 장마감 시황 게시 완료 ({target_date}, category_id={category_id})")
    return True
