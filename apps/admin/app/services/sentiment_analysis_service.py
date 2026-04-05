"""
투자자 심리지수 분석 서비스

7개 하위지표를 산출하고 Gemini AI로 커뮤니티/뉴스 감성을 분석하여
종합 심리지수(0~100)를 생성한다.

지표별 가중치:
  (1) 시장 모멘텀  20%   - DomesticIndexSnapshot
  (2) VIX 변동성   10%   - YahooIndexSnapshot
  (3) 수급 동향    20%   - NaverSupplyData
  (4) 거래량 이상도 10%  - NaverSupplyData
  (5) 커뮤니티 감성 20%  - CommunityPost + Gemini
  (6) 뉴스 감성    10%   - NaverStockNews + Gemini
  (7) 스크리닝 신호 10%  - StockScreeningResult
"""
import json
from datetime import date, datetime, timedelta
from typing import Optional, Tuple

import pytz
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, desc

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.engine.models import (
    CommunityPost,
    DomesticIndexSnapshot,
    SentimentSnapshot,
    StockScreeningResult,
    YahooIndexSnapshot,
)
from app.models import NaverSupplyData, NaverStockNews
from app.services.gemini_response_utils import (
    extract_text_from_generate_content_response,
    extract_first_json_object,
)

_KST = pytz.timezone("Asia/Seoul")

# 가중치
_WEIGHTS = {
    "momentum": 0.20,
    "vix": 0.10,
    "supply": 0.20,
    "volume": 0.10,
    "community": 0.20,
    "news": 0.10,
    "signal": 0.10,
}


def _clamp(val: float, lo: float = 0, hi: float = 100) -> int:
    return max(lo, min(hi, round(val)))


# ─────────────────────────────────────────────
# (1) 시장 모멘텀
# ─────────────────────────────────────────────

def _calc_momentum_score(db: Session, kst_date: date) -> Tuple[int, dict]:
    """KOSPI + KOSDAQ 등락률 → 0~100.  +3%=100, -3%=0"""
    raw = {}
    total_pct = 0.0
    count = 0
    for code in ("KOSPI", "KOSDAQ"):
        row = (
            db.query(DomesticIndexSnapshot)
            .filter(
                DomesticIndexSnapshot.index_code == code,
                DomesticIndexSnapshot.collected_date == kst_date,
            )
            .order_by(desc(DomesticIndexSnapshot.collected_at))
            .first()
        )
        if not row:
            # 전일 fallback
            row = (
                db.query(DomesticIndexSnapshot)
                .filter(DomesticIndexSnapshot.index_code == code)
                .order_by(desc(DomesticIndexSnapshot.collected_at))
                .first()
            )
        if row and row.change_percent is not None:
            raw[code.lower() + "_chg"] = row.change_percent
            total_pct += row.change_percent
            count += 1

    if count == 0:
        return 50, raw  # 데이터 없으면 중립

    avg_pct = total_pct / count
    # -3% → 0,  0% → 50,  +3% → 100 (선형 보간)
    score = _clamp((avg_pct + 3) / 6 * 100)
    raw["avg_pct"] = round(avg_pct, 2)
    return score, raw


# ─────────────────────────────────────────────
# (2) VIX 변동성 (역변환)
# ─────────────────────────────────────────────

def _calc_vix_score(db: Session) -> Tuple[int, dict]:
    """VIX 12→100, VIX 35→0 (선형 역변환)"""
    row = (
        db.query(YahooIndexSnapshot)
        .filter(YahooIndexSnapshot.symbol == "^VIX")
        .order_by(desc(YahooIndexSnapshot.collected_at))
        .first()
    )
    if not row or row.price is None:
        return 50, {}

    vix = row.price
    # VIX 12 이하 → 100 (극도의 안도), VIX 35 이상 → 0 (극도의 공포)
    score = _clamp((35 - vix) / (35 - 12) * 100)
    return score, {"vix": round(vix, 2)}


# ─────────────────────────────────────────────
# (3) 수급 동향 (외국인 + 기관 순매수)
# ─────────────────────────────────────────────

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


def _get_supply_net_buy(db: Session, bizdate: str) -> Optional[dict]:
    """investor_time에서 외국인+기관 순매수 합산 (억원)"""
    for market in ("kospi", "all"):
        row = (
            db.query(NaverSupplyData)
            .filter(
                NaverSupplyData.data_type == "investor_time",
                NaverSupplyData.market == market,
                NaverSupplyData.bizdate == bizdate,
            )
            .order_by(desc(NaverSupplyData.collected_at))
            .first()
        )
        if row and row.data_json:
            break
    else:
        return None

    try:
        data = json.loads(row.data_json)
        headers = data.get("headers") or []
        rows = data.get("rows") or []
        if not rows:
            return None
        last_row = rows[-1]
        idx_f = _find_col_idx(headers, ["외국인계", "외국인"], ["기타외국인"])
        idx_inst = _find_col_idx(headers, ["기관계", "기관"])
        foreign = _parse_num(last_row[idx_f]) if idx_f >= 0 and idx_f < len(last_row) else 0
        institution = _parse_num(last_row[idx_inst]) if idx_inst >= 0 and idx_inst < len(last_row) else 0
        return {"foreign": foreign, "institution": institution, "total": foreign + institution}
    except Exception:
        return None


def _calc_supply_score(db: Session, bizdate: str) -> Tuple[int, dict]:
    """외국인+기관 순매수 합산 → 0~100.  -5000억=0, +5000억=100"""
    result = _get_supply_net_buy(db, bizdate)
    if not result:
        return 50, {}

    total = result["total"]  # 억원 단위
    # -5000억 → 0, 0 → 50, +5000억 → 100
    score = _clamp((total + 5000) / 10000 * 100)
    return score, result


# ─────────────────────────────────────────────
# (4) 거래량 이상도
# ─────────────────────────────────────────────

def _calc_volume_score(db: Session, kst_date: date, market_up: bool) -> Tuple[int, dict]:
    """
    KOSPI 거래량을 최근 5일 평균 대비 비율로 산출.
    상승 + 거래량 증가 → 탐욕,  하락 + 거래량 증가 → 공포
    """
    # 최근 supply 데이터에서 거래량 추출은 복잡하므로
    # DomesticIndexSnapshot의 시가총액 변화를 대리 지표로 사용하거나
    # 단순히 모멘텀과 연동
    # 간소화 구현: 거래량 데이터를 직접 구하기 어려우면 모멘텀과 연동하여 보정
    raw = {}

    # StockScreeningResult의 volume 데이터를 활용
    today_str = kst_date.strftime("%Y-%m-%d")
    yesterday = (kst_date - timedelta(days=1)).strftime("%Y-%m-%d")

    today_count = (
        db.query(sa_func.count(StockScreeningResult.id))
        .filter(StockScreeningResult.screening_date == today_str)
        .scalar()
    ) or 0

    prev_count = (
        db.query(sa_func.count(StockScreeningResult.id))
        .filter(StockScreeningResult.screening_date == yesterday)
        .scalar()
    ) or 0

    raw["today_screened"] = today_count
    raw["prev_screened"] = prev_count

    if prev_count == 0 and today_count == 0:
        return 50, raw

    # 스크리닝 종목 수 변화로 시장 활동 대리 추정
    if prev_count > 0:
        ratio = today_count / prev_count
    else:
        ratio = 1.5 if today_count > 0 else 1.0

    # 상승장 + 활발 → 탐욕(높은 점수), 하락장 + 활발 → 공포(낮은 점수)
    if market_up:
        score = _clamp(50 + (ratio - 1) * 100)
    else:
        score = _clamp(50 - (ratio - 1) * 100)

    raw["ratio"] = round(ratio, 2)
    return score, raw


# ─────────────────────────────────────────────
# (5)+(6) 커뮤니티 + 뉴스 감성 (Gemini 통합 1회)
# ─────────────────────────────────────────────

def _get_community_titles(db: Session, kst_date: date) -> dict:
    """오늘 수집된 커뮤니티 제목 조회"""
    today_str = kst_date.strftime("%Y-%m-%d")
    naver_rows = (
        db.query(CommunityPost)
        .filter(CommunityPost.collected_date == today_str, CommunityPost.source == "naver_forum")
        .order_by(desc(CommunityPost.view_count))
        .limit(50)
        .all()
    )
    dc_rows = (
        db.query(CommunityPost)
        .filter(CommunityPost.collected_date == today_str, CommunityPost.source == "dcinside")
        .order_by(desc(CommunityPost.like_count))
        .limit(50)
        .all()
    )
    return {
        "naver": [{"title": r.title, "view_count": r.view_count} for r in naver_rows],
        "dc": [{"title": r.title, "like_count": r.like_count} for r in dc_rows],
    }


def _get_news_titles(db: Session, kst_date: date, limit: int = 30) -> list[dict]:
    """오늘 수집된 뉴스 제목 조회"""
    start = _KST.localize(datetime(kst_date.year, kst_date.month, kst_date.day, 0, 0, 0))
    end = _KST.localize(datetime(kst_date.year, kst_date.month, kst_date.day, 23, 59, 59))
    rows = (
        db.query(NaverStockNews)
        .filter(NaverStockNews.collected_at >= start, NaverStockNews.collected_at <= end)
        .order_by(desc(NaverStockNews.pub_datetime))
        .limit(limit)
        .all()
    )
    return [{"category": r.category, "title": (r.title or "").strip()} for r in rows]


def _build_gemini_prompt(community: dict, news: list[dict]) -> str:
    """커뮤니티+뉴스 통합 Gemini 프롬프트"""
    lines = []
    lines.append("다음은 한국 투자 커뮤니티와 뉴스에서 수집한 최근 게시글 제목들입니다.")
    lines.append("")

    # 네이버
    lines.append("[네이버 금융 시장토론] (조회수 순)")
    for i, p in enumerate(community.get("naver", [])[:30], 1):
        lines.append(f"{i}. {p['title']} (조회 {p.get('view_count', 0)})")
    lines.append("")

    # DC
    lines.append("[DC인사이드 주식갤러리] (추천수 순)")
    for i, p in enumerate(community.get("dc", [])[:30], 1):
        lines.append(f"{i}. {p['title']} (추천 {p.get('like_count', 0)})")
    lines.append("")

    # 뉴스
    lines.append("[최근 주요 뉴스]")
    for i, n in enumerate(news[:30], 1):
        cat = n.get("category", "")
        title = n.get("title", "")
        lines.append(f"{i}. [{cat}] {title}")
    lines.append("")

    lines.append("위 내용을 분석하여 다음 JSON 형식으로 응답해주세요.")
    lines.append("community_score는 커뮤니티 게시글의 전반적 투자 심리(0=극도의 공포, 50=중립, 100=극도의 탐욕),")
    lines.append("news_score는 뉴스의 전반적 시장 영향(0=매우 부정적, 50=중립, 100=매우 긍정적)입니다.")
    lines.append("")
    lines.append("""{
  "community_score": 0~100 사이 정수,
  "news_score": 0~100 사이 정수,
  "overall_mood": "한 문장으로 현재 투자 심리 요약",
  "top_keywords": ["키워드1", "키워드2", ...최대 10개],
  "reasoning": "2~3문장으로 점수 산정 근거"
}""")
    lines.append("")
    lines.append("반드시 유효한 JSON만 응답하세요. 마크다운 코드블록 없이 JSON만 작성하세요.")

    return "\n".join(lines)


def _call_gemini_sentiment(prompt: str) -> Optional[dict]:
    """Gemini API 호출 → JSON 파싱"""
    if not GEMINI_API_KEY:
        print("[심리지수] GEMINI_API_KEY 없음, AI 분석 건너뜀")
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        text = extract_text_from_generate_content_response(
            response, log_prefix="sentiment-gemini", log_if_empty=True
        )
        if not text:
            return None

        json_str = extract_first_json_object(text)
        if json_str:
            return json.loads(json_str)

        # fallback: 직접 JSON 파싱 시도
        return json.loads(text)
    except Exception as e:
        print(f"[심리지수] Gemini 호출 오류: {e}")
        return None


def _calc_sentiment_scores(db: Session, kst_date: date) -> Tuple[int, int, dict]:
    """(5) 커뮤니티 감성 + (6) 뉴스 감성 → (community_score, news_score, raw)"""
    community = _get_community_titles(db, kst_date)
    news = _get_news_titles(db, kst_date)

    total_titles = len(community.get("naver", [])) + len(community.get("dc", [])) + len(news)
    if total_titles == 0:
        return 50, 50, {"note": "데이터 없음"}

    prompt = _build_gemini_prompt(community, news)
    result = _call_gemini_sentiment(prompt)

    if not result:
        return 50, 50, {"note": "Gemini 응답 없음"}

    community_score = _clamp(result.get("community_score", 50))
    news_score = _clamp(result.get("news_score", 50))
    raw = {
        "overall_mood": result.get("overall_mood", ""),
        "top_keywords": result.get("top_keywords", []),
        "reasoning": result.get("reasoning", ""),
        "naver_count": len(community.get("naver", [])),
        "dc_count": len(community.get("dc", [])),
        "news_count": len(news),
    }
    return community_score, news_score, raw


# ─────────────────────────────────────────────
# (7) 스크리닝 신호비율
# ─────────────────────────────────────────────

def _calc_signal_score(db: Session, screening_date: str) -> Tuple[int, dict]:
    """
    스크리닝 조건충족 종목 비율 → 0~100.
    전체 대비 충족 비율이 20% 이상이면 100(탐욕).
    """
    total = (
        db.query(sa_func.count(StockScreeningResult.id))
        .filter(StockScreeningResult.screening_date == screening_date)
        .scalar()
    ) or 0

    if total == 0:
        # 전일 fallback
        prev_date = (
            db.query(StockScreeningResult.screening_date)
            .filter(StockScreeningResult.screening_date < screening_date)
            .order_by(desc(StockScreeningResult.screening_date))
            .first()
        )
        if prev_date:
            screening_date = prev_date[0]
            total = (
                db.query(sa_func.count(StockScreeningResult.id))
                .filter(StockScreeningResult.screening_date == screening_date)
                .scalar()
            ) or 0

    if total == 0:
        return 50, {"note": "스크리닝 데이터 없음"}

    # 전체 스크리닝 대상(약 500종목) 대비 조건충족 비율
    # total이 스크리닝 결과에 포함된 종목 수 (= 조건 충족 종목)
    # 대상 종목은 약 500개
    target_count = 500
    ratio = total / target_count
    # 비율 20% 이상 → 100, 0% → 0
    score = _clamp(ratio / 0.20 * 100)

    return score, {"matched": total, "target": target_count, "ratio": round(ratio * 100, 1), "date": screening_date}


# ─────────────────────────────────────────────
# 라벨 매핑
# ─────────────────────────────────────────────

def _get_label(score: int) -> str:
    if score <= 25:
        return "공포"
    if score <= 44:
        return "불안"
    if score <= 55:
        return "보통"
    if score <= 75:
        return "과욕"
    return "탐욕"


# ─────────────────────────────────────────────
# 종합 파이프라인
# ─────────────────────────────────────────────

async def generate_sentiment_snapshot(db: Session) -> Optional[SentimentSnapshot]:
    """7개 지표 산출 → 가중평균 → SentimentSnapshot 저장"""
    now = datetime.now(_KST)
    kst_date = now.date()
    today_str = kst_date.strftime("%Y-%m-%d")
    bizdate = kst_date.strftime("%Y%m%d")
    time_str = now.strftime("%H:%M")

    print(f"[심리지수] 분석 시작 ({today_str} {time_str})")

    # (1) 시장 모멘텀
    momentum_score, momentum_raw = _calc_momentum_score(db, kst_date)
    market_up = momentum_score >= 50
    print(f"  (1) 모멘텀: {momentum_score}")

    # (2) VIX
    vix_score, vix_raw = _calc_vix_score(db)
    print(f"  (2) VIX: {vix_score}")

    # (3) 수급
    supply_score, supply_raw = _calc_supply_score(db, bizdate)
    print(f"  (3) 수급: {supply_score}")

    # (4) 거래량 이상도
    volume_score, volume_raw = _calc_volume_score(db, kst_date, market_up)
    print(f"  (4) 거래량: {volume_score}")

    # (5)+(6) 커뮤니티 + 뉴스 감성 (Gemini 1회 호출)
    community_score, news_score, sentiment_raw = _calc_sentiment_scores(db, kst_date)
    print(f"  (5) 커뮤니티: {community_score}")
    print(f"  (6) 뉴스: {news_score}")

    # (7) 스크리닝 신호
    signal_score, signal_raw = _calc_signal_score(db, today_str)
    print(f"  (7) 신호비율: {signal_score}")

    # 가중 평균
    composite = round(
        momentum_score * _WEIGHTS["momentum"]
        + vix_score * _WEIGHTS["vix"]
        + supply_score * _WEIGHTS["supply"]
        + volume_score * _WEIGHTS["volume"]
        + community_score * _WEIGHTS["community"]
        + news_score * _WEIGHTS["news"]
        + signal_score * _WEIGHTS["signal"]
    )
    composite = _clamp(composite)
    label = _get_label(composite)

    print(f"  종합: {composite}점 ({label})")

    # raw_data 통합
    raw_data = {
        "momentum": momentum_raw,
        "vix": vix_raw,
        "supply": supply_raw,
        "volume": volume_raw,
        "sentiment": sentiment_raw,
        "signal": signal_raw,
    }

    # AI 분석 텍스트
    ai_analysis = sentiment_raw.get("overall_mood", "")
    reasoning = sentiment_raw.get("reasoning", "")
    if reasoning:
        ai_analysis = f"{ai_analysis}\n{reasoning}" if ai_analysis else reasoning

    top_keywords = sentiment_raw.get("top_keywords", [])

    # DB upsert (같은 날짜+시간은 덮어쓰기)
    existing = (
        db.query(SentimentSnapshot)
        .filter(
            SentimentSnapshot.snapshot_date == today_str,
            SentimentSnapshot.snapshot_time == time_str,
        )
        .first()
    )

    if existing:
        existing.momentum_score = momentum_score
        existing.vix_score = vix_score
        existing.supply_score = supply_score
        existing.volume_score = volume_score
        existing.community_score = community_score
        existing.news_score = news_score
        existing.signal_score = signal_score
        existing.composite_score = composite
        existing.label = label
        existing.ai_analysis = ai_analysis
        existing.top_keywords = json.dumps(top_keywords, ensure_ascii=False)
        existing.raw_data = json.dumps(raw_data, ensure_ascii=False)
        snapshot = existing
    else:
        snapshot = SentimentSnapshot(
            snapshot_date=today_str,
            snapshot_time=time_str,
            momentum_score=momentum_score,
            vix_score=vix_score,
            supply_score=supply_score,
            volume_score=volume_score,
            community_score=community_score,
            news_score=news_score,
            signal_score=signal_score,
            composite_score=composite,
            label=label,
            ai_analysis=ai_analysis,
            top_keywords=json.dumps(top_keywords, ensure_ascii=False),
            raw_data=json.dumps(raw_data, ensure_ascii=False),
        )
        db.add(snapshot)

    db.commit()
    db.refresh(snapshot)

    # 90일 이전 정리
    _cleanup_old_snapshots(db, days=90)

    return snapshot


def _cleanup_old_snapshots(db: Session, days: int = 90):
    """오래된 스냅샷 삭제"""
    cutoff = (datetime.now(_KST) - timedelta(days=days)).strftime("%Y-%m-%d")
    db.query(SentimentSnapshot).filter(SentimentSnapshot.snapshot_date < cutoff).delete()
    db.commit()
