"""
투자은행 뉴스 (GS, MS, JPM) - Yahoo 뉴스 수집, BO 승인/거절
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_api_key
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/investment-bank-news", response_class=HTMLResponse)
async def admin_investment_bank_news_page(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투자은행 뉴스 관리 (승인/거절)"""
    if not user:
        return RedirectResponse(url="/")

    q = db.query(models.InvestmentBankNews)
    if status_filter in ("pending", "approved"):
        q = q.filter(models.InvestmentBankNews.status == status_filter)
    items = q.order_by(models.InvestmentBankNews.created_at.desc()).limit(200).all()
    pending_count = db.query(models.InvestmentBankNews).filter(
        models.InvestmentBankNews.status == "pending"
    ).count()

    return templates.TemplateResponse(
        "admin_investment_bank_news.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "investment-bank-news",
            "items": items,
            "pending_count": pending_count,
            "status_filter": status_filter or "",
        },
    )


@router.post("/api/investment-bank-news/collect")
async def manual_collect_investment_bank_news(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """수동 수집"""
    if not user:
        return JSONResponse({"success": False, "message": "Unauthorized"}, status_code=401)
    from app.services.investment_bank_news_service import fetch_and_save_investment_bank_news
    result = await fetch_and_save_investment_bank_news(db)
    return JSONResponse({"success": True, "saved": result["saved"], "fetched": result["fetched"]})


@router.post("/api/investment-bank-news/{item_id}/approve")
async def approve_investment_bank_news(
    item_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return JSONResponse({"success": False}, status_code=401)
    item = db.query(models.InvestmentBankNews).filter(models.InvestmentBankNews.id == item_id).first()
    if not item:
        return JSONResponse({"success": False}, status_code=404)
    item.status = "approved"
    item.approved_at = datetime.utcnow()
    db.commit()
    return JSONResponse({"success": True})


@router.post("/api/investment-bank-news/{item_id}/reject")
async def reject_investment_bank_news(
    item_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return JSONResponse({"success": False}, status_code=401)
    item = db.query(models.InvestmentBankNews).filter(models.InvestmentBankNews.id == item_id).first()
    if not item:
        return JSONResponse({"success": False}, status_code=404)
    db.delete(item)
    db.commit()
    return JSONResponse({"success": True})


@router.get("/api/investment-bank-news")
async def get_investment_bank_news_for_app(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    _=Depends(verify_api_key),
):
    """앱용 API (approved만)"""
    rows = (
        db.query(models.InvestmentBankNews)
        .filter(models.InvestmentBankNews.status == "approved")
        .order_by(models.InvestmentBankNews.approved_at.desc().nullslast(), models.InvestmentBankNews.created_at.desc())
        .limit(limit)
        .all()
    )
    data = [
        {
            "id": r.id,
            "source": r.source,
            "title": r.title,
            "summary": r.summary or "",
            "source_url": r.source_url or "",
            "time": r.news_pub_date or (r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""),
        }
        for r in rows
    ]
    return JSONResponse({"success": True, "data": data})
