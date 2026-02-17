"""
약관 관리 라우터 - 개인정보처리방침, 이용약관
"""
from fastapi import APIRouter, Form, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.config import ADMIN_EMAIL

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")

DOC_TYPES = {
    "privacy": ("개인정보처리방침", "privacy"),
    "terms": ("이용약관", "terms"),
}


def get_or_create_document(db: Session, doc_type: str) -> models.LegalDocument:
    doc = db.query(models.LegalDocument).filter(models.LegalDocument.doc_type == doc_type).first()
    if not doc:
        doc = models.LegalDocument(doc_type=doc_type, content="")
        db.add(doc)
        db.commit()
        db.refresh(doc)
    return doc


@router.get("/admin/terms/privacy", response_class=HTMLResponse)
async def admin_terms_privacy_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """개인정보처리방침 편집 페이지"""
    if not user:
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, "privacy")
    if not doc.content:
        doc.content = """주리니 개인정보 보호정책

1. 수집하는 개인정보 항목
회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.
- 필수항목: 이메일 주소, 비밀번호, 닉네임
- 선택항목: 프로필 이미지

2. 개인정보의 수집 및 이용 목적
- 회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 개인식별, 불량회원의 부정이용 방지
- 서비스 제공: 주식 정보 제공, 포트폴리오 관리, 투자 리포트 제공
- 마케팅 및 광고: 이벤트 및 광고성 정보 제공 (동의 시)

3. 개인정보의 보유 및 이용기간
회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다."""

    return templates.TemplateResponse(
        "admin_terms_edit.html",
        {
            "request": request,
            "admin_email": ADMIN_EMAIL,
            "active_page": "terms-privacy",
            "doc": doc,
            "title": "개인정보처리방침",
            "doc_type": "privacy",
        },
    )


@router.get("/admin/terms/service", response_class=HTMLResponse)
async def admin_terms_service_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """이용약관 편집 페이지"""
    if not user:
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, "terms")
    if not doc.content:
        doc.content = """주리니 이용약관

제1조 (목적)
이 약관은 주리니(이하 "회사")가 제공하는 주식 정보 서비스(이하 "서비스")의 이용에 관한 조건 및 절차, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 주식 정보 조회, 포트폴리오 관리, 투자 리포트 등의 서비스를 의미합니다.
2. "회원"이란 회사와 서비스 이용 계약을 체결한 자를 의미합니다."""

    return templates.TemplateResponse(
        "admin_terms_edit.html",
        {
            "request": request,
            "admin_email": ADMIN_EMAIL,
            "active_page": "terms-service",
            "doc": doc,
            "title": "이용약관",
            "doc_type": "terms",
        },
    )


@router.post("/admin/terms/{doc_type}/save")
async def save_terms(
    doc_type: str,
    content: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """약관 저장"""
    if not user or doc_type not in ("privacy", "terms"):
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, doc_type)
    doc.content = content.strip()
    db.commit()
    redirect_url = "/admin/terms/privacy" if doc_type == "privacy" else "/admin/terms/service"
    return RedirectResponse(url=redirect_url, status_code=303)


# ==================== FE API ====================

@router.get("/api/legal-documents/{doc_type}")
async def api_get_legal_document(
    doc_type: str,
    db: Session = Depends(get_db),
):
    """법적 문서 조회 (개인정보처리방침, 이용약관) - FE 공개용"""
    if doc_type not in ("privacy", "terms"):
        return {"success": False, "content": ""}
    doc = db.query(models.LegalDocument).filter(models.LegalDocument.doc_type == doc_type).first()
    content = doc.content if doc else ""
    return {"success": True, "content": content}
