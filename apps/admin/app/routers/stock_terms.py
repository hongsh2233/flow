"""
주식용어 관리 라우터 (용어 CRUD + 검색)
"""
import csv
import io
import json
from fastapi import APIRouter, Form, Query, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, StreamingResponse
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


def _js_alert_redirect(message: str, url: str = "/admin/stock-terms") -> HTMLResponse:
    safe_msg = json.dumps(message, ensure_ascii=False)
    safe_url = json.dumps(url, ensure_ascii=False)
    return HTMLResponse(
        f"<script>alert({safe_msg}); location.href={safe_url};</script>"
    )


def _js_alert_back(message: str) -> HTMLResponse:
    safe_msg = json.dumps(message, ensure_ascii=False)
    return HTMLResponse(
        f"<script>alert({safe_msg}); history.back();</script>"
    )


# 카테고리 목록 (고정)
# NOTE: "대가들의 한마디"는 주식 토크(주톡) 화면의
#       [대가들의 한마디] 섹션에서 사용할 명언/대가 데이터용 카테고리입니다.
CATEGORIES = [
    "기본개념",
    "매매/거래",
    "차트/기술분석",
    "재무/펀더멘털",
    "파생상품",
    "기타",
    "대가들의 한마디",
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
        return _js_alert_back("이미 존재하는 용어입니다.")

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
        return _js_alert_back("용어를 찾을 수 없습니다.")

    # 중복 확인 (자기 자신 제외)
    existing = (
        db.query(models.StockTerm)
        .filter(models.StockTerm.term == term.strip(), models.StockTerm.id != term_id)
        .first()
    )
    if existing:
        return _js_alert_back("이미 존재하는 용어입니다.")

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


@router.post("/admin/stock-terms/bulk-add")
async def bulk_add_stock_terms(
    bulk_data: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """주식용어 일괄 등록

    형식: 각 줄마다 "용어|설명|카테고리" 또는 "용어|설명"
    예시:
    PER|주가를 주당순이익으로 나눈 값. 숫자가 낮을수록 저평가된 주식일 수 있어요.|재무/펀더멘털
    PBR|주가를 주당순자산으로 나눈 값|재무/펀더멘털
    """
    if not user:
        return RedirectResponse(url="/", status_code=303)

    if not bulk_data or not bulk_data.strip():
        return _js_alert_back("입력된 데이터가 없습니다.")

    raw = bulk_data.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in raw.strip().split("\n") if line.strip()]
    if not lines:
        return _js_alert_back("입력된 데이터가 없습니다.")

    success_count = 0
    error_count = 0
    errors: list[str] = []

    for line_num, line in enumerate(lines, 1):
        parts = [p.strip() for p in line.split("|")]

        if len(parts) < 2:
            error_count += 1
            errors.append(f"{line_num}번째 줄: 형식 오류 (용어|설명|카테고리)")
            continue

        term = parts[0]
        description = parts[1]
        category = parts[2] if len(parts) > 2 and parts[2] else ""

        if not term or not description:
            error_count += 1
            errors.append(f"{line_num}번째 줄: 용어와 설명은 필수입니다")
            continue

        existing = db.query(models.StockTerm).filter(models.StockTerm.term == term).first()
        if existing:
            error_count += 1
            errors.append(f"{line_num}번째 줄: [{term}] 이미 존재")
            continue

        try:
            new_term = models.StockTerm(
                term=term,
                description=description,
                category=category if category else None,
            )
            db.add(new_term)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"{line_num}번째 줄: 오류 - {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return _js_alert_back(f"일괄 등록 중 오류가 발생했습니다: {str(e)}")

    if error_count == 0:
        message = f"성공적으로 {success_count}개의 용어가 등록되었습니다."
    else:
        error_msg = "\n".join(errors[:10])
        if len(errors) > 10:
            error_msg += f"\n... 외 {len(errors) - 10}개 오류"
        message = f"등록 완료: {success_count}개 성공, {error_count}개 실패\n\n오류 목록:\n{error_msg}"

    return _js_alert_redirect(message)


# ==================== 다운로드 ====================


@router.get("/admin/stock-terms/download")
async def download_stock_terms(
    fmt: str = Query("csv", description="다운로드 형식 (csv, txt)"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """주식용어 전체 다운로드 (CSV 또는 TXT)"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    terms = db.query(models.StockTerm).order_by(models.StockTerm.term).all()

    if fmt == "txt":
        lines = []
        for t in terms:
            cat = t.category or ""
            lines.append(f"{t.term}|{t.description}|{cat}")
        content = "\n".join(lines)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8-sig")),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=stock_terms.txt"},
        )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["용어", "설명", "카테고리"])
    for t in terms:
        writer.writerow([t.term, t.description, t.category or ""])

    output = buf.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(output),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=stock_terms.csv"},
    )


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
