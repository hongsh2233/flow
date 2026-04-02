"""
시장 데이터 — 보고서 작성
관리자가 직접 수집·작성한 본문을 B001 시황 게시판에 pending 등록한다.
"""
from datetime import datetime
from urllib.parse import quote

import pytz
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services.market_report_situation_service import (
    post_body_to_html,
    upsert_b001_pending_report,
)

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


def _kst_today():
    return datetime.now(pytz.timezone("Asia/Seoul")).date()


@router.get("/admin/market-report", response_class=HTMLResponse)
async def market_report_page(
    request: Request,
    user=Depends(get_current_user),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    today = _kst_today()
    default_title = f"{today.isoformat()} 출근길 브리핑"

    qp = request.query_params
    result = None
    if qp.get("ok") is not None:
        result = {
            "ok": qp.get("ok") == "1",
            "message": qp.get("msg") or "",
        }
    return templates.TemplateResponse(
        "admin_market_report.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "market-report",
            "default_title": default_title,
            "result": result,
        },
    )


@router.post("/admin/market-report/publish")
async def market_report_publish(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    post_title: str = Form(""),
    post_body: str = Form(""),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)

    today = _kst_today()
    date_str = today.isoformat()
    title = (post_title or "").strip() or f"{date_str} 출근길 브리핑"
    raw_body = (post_body or "").strip()
    html_content = post_body_to_html(raw_body)

    if not html_content:
        msg = f"{date_str} 출근길 브리핑 등록 실패 — 게시 본문을 입력해 주세요."
        return RedirectResponse(
            url=f"/admin/market-report?ok=0&msg={quote(msg, safe='')}",
            status_code=303,
        )

    try:
        upsert_b001_pending_report(db, title, html_content, target_date=today, author="관리자")
        msg = f"{date_str} 출근길 브리핑 등록 성공 — 시황 게시판(B001)에 대기(pending)로 등록되었습니다."
        return RedirectResponse(
            url=f"/admin/market-report?ok=1&msg={quote(msg, safe='')}",
            status_code=303,
        )
    except Exception as e:
        db.rollback()
        msg = f"{date_str} 출근길 브리핑 등록 실패 — {str(e)[:280]}"
        return RedirectResponse(
            url=f"/admin/market-report?ok=0&msg={quote(msg, safe='')}",
            status_code=303,
        )
