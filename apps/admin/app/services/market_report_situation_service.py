"""
BO 보고서 작성 — 관리자가 직접 작성한 시황 본문을 B001에 pending 등록한다.
(Gemini·자동 모닝 브리핑 생성 없음)
"""
from __future__ import annotations

import html
from datetime import date, datetime

import pytz
from sqlalchemy import or_
from sqlalchemy.orm import Session


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
    """시황 게시판(B001)에 pending 글 등록 또는 당일 「YYYY-MM-DD …」 모닝·시황·브리핑 글이 있으면 갱신."""
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
            or_(
                Post.title.like("%모닝%"),
                Post.title.like("%시황%"),
                Post.title.like("%브리핑%"),
            ),
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
