"""
시장 데이터 — 보고서 작성 (모닝 브리핑 수동 생성 등)
"""
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/market-report", response_class=HTMLResponse)
async def market_report_page(
    request: Request,
    user=Depends(get_current_user),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
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
            "result": result,
        },
    )


@router.post("/admin/market-report/morning-briefing")
async def market_report_morning_briefing_submit(
    request: Request,
    reference_notes: str = Form(""),
    user=Depends(get_current_user),
):
    """참조문구를 반영해 모닝 브리핑 생성 후 B001 시황 게시판에 pending 등록"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    from app.services.scheduler_service import collect_market_morning_summary

    ref = (reference_notes or "").strip()
    try:
        out = await collect_market_morning_summary(
            reference_notes=ref if ref else None,
        )
        ok = bool(out.get("ok"))
        msg = str(out.get("message") or "")
        q = "ok=1" if ok else "ok=0"
        q += f"&msg={quote(msg, safe='')}"
        return RedirectResponse(url=f"/admin/market-report?{q}", status_code=303)
    except Exception as e:
        return RedirectResponse(
            url=f"/admin/market-report?ok=0&msg={quote(str(e)[:300], safe='')}",
            status_code=303,
        )
