"""
BO 보고서 작성 — DB에 쌓인 시황 원자료를 텍스트로 묶어 관리자가 복사할 수 있게 한다.
(Gemini·자동 모닝 브리핑 생성 없음)
"""
from __future__ import annotations

import html
from datetime import date, datetime
from typing import List

import pytz
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.engine import models

_MORNING_ORDER = {
    "^IXIC": 0,
    "^GSPC": 1,
    "^DJI": 2,
    "^SOX": 3,
    "NQ=F": 4,
    "^KS200": 5,
    "INV:8893": 6,
    "^MSKR": 7,
    "EWY": 8,
    "^KS11": 9,
    "^KQ11": 10,
}

_CURRENCY_LABEL = {"USD": "USD/KRW", "JPY": "JPY/KRW (100엔)", "EUR": "EUR/KRW"}


def build_situation_data_text(db: Session, target_date: date) -> str:
    """당일(KST) 기준: 야후 아침 지수, 최신 국내지수 스냅샷, 최신 환율, 당일 일정."""
    lines: List[str] = []
    lines.append("=== 시황 데이터 (복사용) ===")
    lines.append(f"기준일(KST): {target_date.isoformat()}")
    lines.append("")

    lines.append("[야후 지수 (당일 일별 · morning 우선, 없으면 us/kr/foreign)]")
    raw = (
        db.query(models.YahooIndexDaily)
        .filter(
            models.YahooIndexDaily.date == target_date,
            models.YahooIndexDaily.group.in_(["morning", "us", "kr", "foreign"]),
        )
        .all()
    )
    prio = {"morning": 0, "us": 1, "foreign": 2, "kr": 3}
    by_symbol: dict = {}
    for r in raw:
        if r.price is None:
            continue
        p = prio.get(r.group or "", 99)
        prev = by_symbol.get(r.symbol)
        if prev is None or p < prev[0]:
            by_symbol[r.symbol] = (p, r)
    merged = [pair[1] for pair in by_symbol.values()]
    merged.sort(key=lambda r: (_MORNING_ORDER.get(r.symbol, 99), r.name))
    if not merged:
        lines.append("(데이터 없음 — 야후 지수 스케줄 수집 후 다시 열어주세요.)")
    else:
        for r in merged:
            lines.append(
                f"- {r.name} ({r.symbol}) [{r.group}]: {r.price:,.2f} "
                f"({r.change or 0:+.2f}, {r.change_percent or 0:+.2f}%) "
                f"[수집 {r.last_collected_time}]"
            )
    lines.append("")

    dmax = db.query(func.max(models.DomesticIndexSnapshot.collected_date)).scalar()
    lines.append("[국내 지수 스냅샷 (네이버·최신 일자)]")
    if not dmax:
        lines.append("(데이터 없음)")
    else:
        lines.append(f"스냅샷 일자: {dmax}")
        dom = (
            db.query(models.DomesticIndexSnapshot)
            .filter(models.DomesticIndexSnapshot.collected_date == dmax)
            .order_by(models.DomesticIndexSnapshot.index_code)
            .all()
        )
        for r in dom:
            lines.append(
                f"- {r.name}: {r.price or 0:,.2f} "
                f"({r.change or 0:+.2f}, {r.change_percent or 0:+.2f}%) "
                f"[{r.collected_time}]"
            )
    lines.append("")

    latest_ex = db.query(func.max(models.ExchangeRateSnapshot.collected_at)).scalar()
    lines.append("[환율 (최신 스냅샷)]")
    if not latest_ex:
        lines.append("(데이터 없음)")
    else:
        ex_rows = (
            db.query(models.ExchangeRateSnapshot)
            .filter(models.ExchangeRateSnapshot.collected_at == latest_ex)
            .all()
        )
        for r in ex_rows:
            label = _CURRENCY_LABEL.get(r.currency, r.currency)
            lines.append(
                f"- {label}: {r.rate:,.2f} ({r.change_val:+.2f}) [{r.collected_time}]"
            )
    lines.append("")

    lines.append("[당일 일정 (BO 일정 관리)]")
    sched_rows = (
        db.query(models.Schedule)
        .filter(models.Schedule.date == target_date)
        .order_by(models.Schedule.scheduled_time)
        .all()
    )
    if not sched_rows:
        lines.append("(등록된 일정 없음)")
    else:
        for r in sched_rows:
            t = r.scheduled_time or ""
            sub = (r.subject or "").strip()
            c = (r.content or "").strip()
            extra = f" — {c}" if c else ""
            lines.append(f"- [{t}] {sub}{extra}")

    lines.append("")
    lines.append("--- 위 내용을 복사해 아래 「게시 본문」에 붙여넣은 뒤 문장을 다듬어 주세요. ---")
    return "\n".join(lines)


def post_body_to_html(text: str) -> str:
    """관리자 입력(플레인 텍스트)을 안전한 HTML로 변환."""
    t = (text or "").strip()
    if not t:
        return ""
    esc = html.escape(t)
    return '<div class="flow-market-report">' + esc.replace("\n", "<br />\n") + "</div>"


def upsert_b001_pending_report(
    db: Session,
    title: str,
    content_html: str,
    target_date: date,
    *,
    author: str = "관리자",
) -> None:
    """시황 게시판(B001)에 pending 글 등록 또는 당일 「YYYY-MM-DD … 모닝/시황」 글이 있으면 갱신."""
    from app.engine.models import BoardCategory, Post

    kst = pytz.timezone("Asia/Seoul")
    now_kst = datetime.now(kst)

    category_id = None
    try:
        cat = (
            db.query(BoardCategory)
            .filter(BoardCategory.board_id == "B001", BoardCategory.name == "시황")
            .first()
        )
        if cat:
            category_id = cat.id
    except Exception:
        pass

    dstr = target_date.isoformat()
    existing = (
        db.query(Post)
        .filter(
            Post.board_id == "B001",
            Post.title.like(f"{dstr}%"),
            or_(Post.title.like("%모닝%"), Post.title.like("%시황%")),
        )
        .first()
    )

    if existing:
        existing.title = title
        existing.content = content_html
        existing.status = "pending"
        existing.approved_at = None
        existing.author = author
        if category_id is not None:
            existing.category_id = category_id
        existing.updated_at = now_kst
    else:
        db.add(
            Post(
                board_id="B001",
                title=title,
                content=content_html,
                author=author,
                status="pending",
                category_id=category_id,
                created_at=now_kst,
                updated_at=now_kst,
            )
        )
    db.commit()
