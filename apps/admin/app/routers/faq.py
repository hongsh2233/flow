"""
FAQ 관리 라우터 - 설정 > 지원 > 자주하는 질문과 연동
"""
from fastapi import APIRouter, Form, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.config import ADMIN_EMAIL

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/faq", response_class=HTMLResponse)
async def admin_faq_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FAQ 관리 페이지 (카테고리별 질문/답변 CRUD)"""
    if not user:
        return RedirectResponse(url="/")

    categories = (
        db.query(models.FaqCategory)
        .order_by(models.FaqCategory.order_index, models.FaqCategory.id)
        .all()
    )
    return templates.TemplateResponse(
        "admin_faq.html",
        {
            "request": request,
            "admin_email": ADMIN_EMAIL,
            "active_page": "faq",
            "categories": categories,
        },
    )


@router.post("/admin/faq/category/add")
async def add_faq_category(
    title: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FAQ 카테고리 추가"""
    if not user:
        return RedirectResponse(url="/")
    max_order = db.query(models.FaqCategory).count()
    cat = models.FaqCategory(title=title.strip(), order_index=max_order)
    db.add(cat)
    db.commit()
    return RedirectResponse(url="/admin/faq", status_code=303)


@router.get("/admin/faq/category/{cat_id}/delete")
async def delete_faq_category(
    cat_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FAQ 카테고리 삭제"""
    if not user:
        return RedirectResponse(url="/")
    cat = db.query(models.FaqCategory).filter(models.FaqCategory.id == cat_id).first()
    if cat:
        db.delete(cat)
        db.commit()
    return RedirectResponse(url="/admin/faq", status_code=303)


@router.post("/admin/faq/item/add")
async def add_faq_item(
    category_id: int = Form(...),
    question: str = Form(...),
    answer: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FAQ 항목 추가"""
    if not user:
        return RedirectResponse(url="/")
    cat = db.query(models.FaqCategory).filter(models.FaqCategory.id == category_id).first()
    if not cat:
        return RedirectResponse(url="/admin/faq?error=category_not_found", status_code=303)
    max_order = db.query(models.FaqItem).filter(models.FaqItem.category_id == category_id).count()
    item = models.FaqItem(
        category_id=category_id,
        question=question.strip(),
        answer=answer.strip(),
        order_index=max_order,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/admin/faq", status_code=303)


@router.post("/admin/faq/item/{item_id}/edit")
async def edit_faq_item(
    item_id: int,
    question: str = Form(...),
    answer: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FAQ 항목 수정"""
    if not user:
        return RedirectResponse(url="/")
    item = db.query(models.FaqItem).filter(models.FaqItem.id == item_id).first()
    if item:
        item.question = question.strip()
        item.answer = answer.strip()
        db.commit()
    return RedirectResponse(url="/admin/faq", status_code=303)


@router.get("/admin/faq/item/{item_id}/delete")
async def delete_faq_item(
    item_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FAQ 항목 삭제"""
    if not user:
        return RedirectResponse(url="/")
    item = db.query(models.FaqItem).filter(models.FaqItem.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()
    return RedirectResponse(url="/admin/faq", status_code=303)


# ==================== FE API (설정 > 지원 > 자주하는 질문 연동) ====================

@router.get("/api/faq")
async def api_get_faq(db: Session = Depends(get_db)):
    """
    FAQ 목록 조회 - 설정 > 지원 > 자주하는 질문 UI용
    카테고리별로 question/answer 목록 반환
    """
    categories = (
        db.query(models.FaqCategory)
        .order_by(models.FaqCategory.order_index, models.FaqCategory.id)
        .all()
    )
    result = []
    for cat in categories:
        items = [
            {"question": i.question, "answer": i.answer}
            for i in sorted(cat.items, key=lambda x: (x.order_index, x.id))
        ]
        if items:
            result.append({"title": cat.title, "items": items})
    return {"success": True, "data": result}
