"""
장마감 시황 Gemini AI 처리 서비스

15:30 수집된 KR지수·수급동향·뉴스 데이터를 Gemini에 전달하고
구조화된 시황 문장을 생성해 board/B001에 Post로 등록한다.

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

from app.config import GEMINI_API_KEY
from app.engine.models import (
    YahooIndexDaily,
    ExchangeRateSnapshot,
    NaverSupplyData,
    FscRisingStock,
    NaverStockNews,
    Post,
)


# ──────────────────────────────────────────────
# 데이터 수집 헬퍼
# ──────────────────────────────────────────────

def _get_kr_indices(db: Session, target_date: date) -> List[dict]:
    """YahooIndexDaily에서 오늘 KR 지수 조회 (^KS11, ^KQ11)"""
    rows = db.query(YahooIndexDaily).filter(
        YahooIndexDaily.date == target_date,
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


# ──────────────────────────────────────────────
# Gemini 프롬프트 생성
# ──────────────────────────────────────────────

def _build_prompt(
    kr_indices: List[dict],
    exchange_rates: List[dict],
    deal_rank: Dict[str, List[str]],
    upper_limit: List[str],
    news: List[dict],
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

def _extract_text_from_gemini_response(response) -> str:
    """Gemini 응답에서 텍스트 추출. response.parts → response.text → candidates 순으로 시도.
    gemini-2.5-flash thinking 파트(thought=True)는 제외한다."""
    text = ""
    parts = getattr(response, "parts", None)
    if parts:
        for part in parts:
            if getattr(part, "thought", False):  # thinking 추론 파트 skip
                continue
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
                if getattr(part, "thought", False):  # thinking 추론 파트 skip
                    continue
                pt = getattr(part, "text", None)
                if pt:
                    text += str(pt)
            if text:
                break
    return (text or "").strip()


def _call_gemini(prompt: str) -> Optional[Dict[str, str]]:
    if not GEMINI_API_KEY:
        print("[closing-gemini] GEMINI_API_KEY 없음, 건너뜀")
        return None
    text = ""
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = _extract_text_from_gemini_response(response)

        # 코드블록 제거 (위치 무관 - thinking 잔류 텍스트 뒤에 올 수 있으므로 앵커 없이)
        text = re.sub(r"```(?:json)?\s*", "", text)
        text = re.sub(r"```", "", text)
        # JSON 객체만 추출 (앞뒤 불필요한 텍스트 제거)
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
        data = json.loads(text)
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

def _build_post_content(
    kr_indices: List[dict],
    exchange_rates: List[dict],
    news: List[dict],
    ai: Dict[str, str],
    upper_limit: List[str],
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

    content = f"""<div class="market-closing-summary">
<h3>① 주가지수</h3>
{idx_html}
<h3>② 핵심 뉴스</h3>
{news_html}
<h3>③ 시장 총평</h3>
<p>{ai.get("summary", "")}</p>

<h3>④ 환율</h3>
<p>USD/KRW {ex_str}</p>
<p>{ai.get("exchange_rate", "")}</p>

<h3>⑤ 외국인·기관 동향</h3>
<p>{ai.get("supply_trend", "")}</p>

<h3>⑥ 오늘 특징 (상한가·업종·테마)</h3>
{upper_html}<p>{ai.get("today_highlight", "")}</p>

<h3>⑦ 내일 주목할 점</h3>
<p>{ai.get("tomorrow_focus", "")}</p>

<p style="margin-top:24px;font-size:12px;color:#999;">※ 본 시황은 AI가 자동 생성한 콘텐츠로, 데이터 수집 시점의 차이로 인해 실제 수치와 약간의 오차가 있을 수 있습니다. 투자 판단의 참고 자료로만 활용하시기 바랍니다.</p>
</div>"""
    return content


# ──────────────────────────────────────────────
# 메인 진입점
# ──────────────────────────────────────────────

def generate_and_post_closing_summary(db: Session, target_date: date) -> bool:
    """
    장마감 시황을 Gemini로 생성하고 board/B001에 Post로 등록(upsert)한다.

    Returns:
        True if saved, False on failure
    """
    bizdate = target_date.strftime("%Y%m%d")
    title = f"{target_date.strftime('%Y-%m-%d')} 장마감 시황"

    # 데이터 수집
    kr_indices    = _get_kr_indices(db, target_date)
    exchange_rates = _get_exchange_rate(db)
    deal_rank     = _get_deal_rank(db, bizdate)
    upper_limit   = _get_upper_limit_stocks(db, bizdate)
    news          = _get_top_news(db, target_date)

    if not kr_indices:
        print("[closing-gemini] KR 지수 데이터 없음, 건너뜀")
        return False

    # Gemini 호출
    prompt = _build_prompt(kr_indices, exchange_rates, deal_rank, upper_limit, news)
    ai = _call_gemini(prompt)
    if not ai:
        return False

    # 게시글 내용 조립
    content = _build_post_content(kr_indices, exchange_rates, news, ai, upper_limit)

    # B001 게시판에 upsert (같은 날짜 제목이 있으면 내용 업데이트)
    existing = (
        db.query(Post)
        .filter(Post.board_id == "B001", Post.title == title)
        .first()
    )
    if existing:
        existing.content = content
    else:
        db.add(Post(
            board_id="B001",
            title=title,
            content=content,
            author="플로우Ai",
        ))
    db.commit()
    print(f"[closing-gemini] 장마감 시황 게시 완료 ({target_date})")
    return True
