"""
주식용어 관리 라우터 (용어 CRUD + 검색)
"""
from fastapi import APIRouter, Form, Query, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from app import models
from app.database import get_db
from app.dependencies import get_current_user, verify_api_key
from app.config import ADMIN_EMAIL

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")

# 카테고리 목록 (고정)
CATEGORIES = [
    "기본개념",
    "매매/거래",
    "차트/기술분석",
    "재무/펀더멘털",
    "파생상품",
    "기타",
]


@router.get("/admin/stock-terms", response_class=HTMLResponse)
async def admin_stock_terms_page(
    request: Request,
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """주식용어 관리 페이지 (검색 + 페이지네이션)"""
    if not user:
        return RedirectResponse(url="/")

    per_page = 20
    query = db.query(models.StockTerm)

    if q and q.strip():
        search = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.StockTerm.term.ilike(search),
                models.StockTerm.description.ilike(search),
            )
        )

    if category and category.strip():
        query = query.filter(models.StockTerm.category == category.strip())

    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    page = min(page, total_pages)

    terms = (
        query.order_by(models.StockTerm.term)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return templates.TemplateResponse(
        "admin_stock_terms.html",
        {
            "request": request,
            "admin_email": ADMIN_EMAIL,
            "active_page": "stock-terms",
            "terms": terms,
            "total": total,
            "page": page,
            "total_pages": total_pages,
            "q": q or "",
            "category": category or "",
            "categories": CATEGORIES,
        },
    )


# ==================== CRUD ====================


@router.post("/admin/stock-terms/add")
async def add_stock_term(
    term: str = Form(...),
    description: str = Form(...),
    category: str = Form(""),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """주식용어 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    existing = db.query(models.StockTerm).filter(models.StockTerm.term == term.strip()).first()
    if existing:
        return HTMLResponse(
            "<script>alert('이미 존재하는 용어입니다.'); history.back();</script>"
        )

    new_term = models.StockTerm(
        term=term.strip(),
        description=description.strip(),
        category=category.strip() if category.strip() else None,
    )
    db.add(new_term)
    db.commit()

    return RedirectResponse(url="/admin/stock-terms", status_code=303)


@router.post("/admin/stock-terms/update/{term_id}")
async def update_stock_term(
    term_id: int,
    term: str = Form(...),
    description: str = Form(...),
    category: str = Form(""),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """주식용어 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    stock_term = db.query(models.StockTerm).filter(models.StockTerm.id == term_id).first()
    if not stock_term:
        return HTMLResponse(
            "<script>alert('용어를 찾을 수 없습니다.'); history.back();</script>"
        )

    # 중복 확인 (자기 자신 제외)
    existing = (
        db.query(models.StockTerm)
        .filter(models.StockTerm.term == term.strip(), models.StockTerm.id != term_id)
        .first()
    )
    if existing:
        return HTMLResponse(
            "<script>alert('이미 존재하는 용어입니다.'); history.back();</script>"
        )

    stock_term.term = term.strip()
    stock_term.description = description.strip()
    stock_term.category = category.strip() if category.strip() else None
    db.commit()

    return RedirectResponse(url="/admin/stock-terms", status_code=303)


@router.get("/admin/stock-terms/delete/{term_id}")
async def delete_stock_term(
    term_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """주식용어 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    stock_term = db.query(models.StockTerm).filter(models.StockTerm.id == term_id).first()
    if stock_term:
        db.delete(stock_term)
        db.commit()

    return RedirectResponse(url="/admin/stock-terms", status_code=303)


# ==================== REST API (프론트엔드용) ====================


@router.get("/api/stock-terms")
async def api_stock_terms(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    """주식용어 검색 API (프론트엔드용)"""
    query = db.query(models.StockTerm)

    if q and q.strip():
        search = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.StockTerm.term.ilike(search),
                models.StockTerm.description.ilike(search),
            )
        )

    if category and category.strip():
        query = query.filter(models.StockTerm.category == category.strip())

    total = query.count()
    terms = (
        query.order_by(models.StockTerm.term)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [
            {
                "id": t.id,
                "term": t.term,
                "description": t.description,
                "category": t.category,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            }
            for t in terms
        ],
    }
