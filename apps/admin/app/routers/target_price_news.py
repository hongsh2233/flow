"""
증권사 목표가 상향 뉴스 - 네이버 뉴스 + Gemini → B002 '목표가 조정' 카테고리 등록
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/target-price-news", response_class=HTMLResponse)
async def admin_target_price_news_page(
    request: Request,
    user=Depends(get_current_user),
):
    """목표가 상향 뉴스 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "admin_target_price_news.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "target-price-news",
        },
    )


@router.post("/api/target-price-news/collect")
async def manual_collect_target_price_news(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """수동 수집·등록 (네이버 뉴스 → Gemini → B002 목표가 조정)"""
    if not user:
        return JSONResponse({"success": False, "message": "Unauthorized"}, status_code=401)
    from app.services.target_price_news_service import fetch_and_post_target_price_news
    result = await fetch_and_post_target_price_news(db)
    return JSONResponse({
        "success": True,
        "fetched": result["fetched"],
        "posted": result["posted"],
    })
