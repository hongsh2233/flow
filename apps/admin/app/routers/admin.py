"""
관리자 관리 라우터
"""
from fastapi import APIRouter, Form, Request, Depends, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import os
from datetime import datetime

from app import models, utils
from app.database import get_db
from app.dependencies import get_current_user
from app.config import ADMIN_EMAIL

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/users", response_class=HTMLResponse)
async def admin_users_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    
    db_users = db.query(models.AdminUser).all()
    
    return templates.TemplateResponse("admin_users.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "users": db_users,
        "active_page": "users"
    })


@router.post("/admin/users/add")
async def add_admin(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    if db.query(models.AdminUser).filter(models.AdminUser.email == email).first():
        return HTMLResponse("<script>alert('이미 존재하는 이메일입니다.'); history.back();</script>")
    
    new_admin = models.AdminUser(
        email=email,
        name=name,
        hashed_password=utils.get_password_hash(password)
    )
    db.add(new_admin)
    db.commit()
    
    return RedirectResponse(url="/admin/users", status_code=303)


@router.get("/admin/users/delete/{email}")
async def delete_admin(
    email: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    if email == ADMIN_EMAIL:
        return HTMLResponse("<script>alert('최고 관리자 계정은 삭제할 수 없습니다.'); location.href='/admin/users';</script>")
    
    target_user = db.query(models.AdminUser).filter(models.AdminUser.email == email).first()
    if target_user:
        db.delete(target_user)
        db.commit()
    
    return RedirectResponse(url="/admin/users", status_code=303)


# ==================== 배너 관리 ====================

@router.get("/admin/banners/{banner_type}", response_class=HTMLResponse)
async def admin_banners_page(
    banner_type: str,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """배너 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    
    if banner_type not in ["top_banner", "banner"]:
        return RedirectResponse(url="/admin/dashboard")
    
    banners = db.query(models.Banner).filter(
        models.Banner.type == banner_type
    ).order_by(models.Banner.order_index).all()
    
    banner_name = "상단배너" if banner_type == "top_banner" else "배너"
    
    return templates.TemplateResponse("admin_banners.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "banners": banners,
        "banner_type": banner_type,
        "banner_name": banner_name,
        "active_page": "board"
    })


@router.post("/admin/banners/add")
async def add_banner(
    banner_type: str = Form(...),
    image_url: str = Form(...),
    link_url: Optional[str] = Form(None),
    alt_text: Optional[str] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """배너 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    if banner_type not in ["top_banner", "banner"]:
        return HTMLResponse("<script>alert('잘못된 배너 타입입니다.'); history.back();</script>")
    
    # 이미지 파일이 선택되지 않았는지 확인
    has_image_file = image_file and image_file.filename
    image_url_trimmed = (image_url or "").strip()
    
    # 이미지 파일도 없고 image_url도 비어있으면 에러
    if not has_image_file and not image_url_trimmed:
        return HTMLResponse("<script>alert('이미지를 추가해주세요.'); history.back();</script>")
    
    # 파일이 업로드된 경우 처리
    final_image_url = image_url_trimmed
    if has_image_file:
        try:
            # 파일 크기 체크 (5MB)
            file_content = await image_file.read()
            if len(file_content) > 5 * 1024 * 1024:
                return HTMLResponse("<script>alert('파일 크기는 5MB 이하여야 합니다.'); history.back();</script>")
            
            # 이미지 파일만 허용
            if not image_file.content_type or not image_file.content_type.startswith('image/'):
                return HTMLResponse("<script>alert('이미지 파일만 업로드 가능합니다.'); history.back();</script>")
            
            # uploads/banners 디렉토리 생성
            upload_dir = "uploads/banners"
            os.makedirs(upload_dir, exist_ok=True)
            
            # 파일명 생성
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_name = "".join(c for c in image_file.filename if c.isalnum() or c in "._- ") if image_file.filename else "image"
            safe_filename = f"{timestamp}_{safe_name}"
            file_path = os.path.join(upload_dir, safe_filename)
            
            # 파일 저장
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            final_image_url = f"/uploads/banners/{safe_filename}"
        except Exception as e:
            return HTMLResponse(f"<script>alert('이미지 업로드 실패: {str(e)}'); history.back();</script>")
    
    # 최종 이미지 URL 검증
    if not final_image_url or not final_image_url.strip():
        return HTMLResponse("<script>alert('이미지를 추가해주세요.'); history.back();</script>")
    
    # 마지막 order_index 가져오기
    last_banner = db.query(models.Banner).filter(
        models.Banner.type == banner_type
    ).order_by(models.Banner.order_index.desc()).first()
    next_order = (last_banner.order_index + 1) if last_banner else 0
    
    new_banner = models.Banner(
        type=banner_type,
        image_url=final_image_url,
        link_url=link_url or "",
        alt_text=alt_text or "",
        order_index=next_order,
        is_active="active"
    )
    db.add(new_banner)
    db.commit()
    
    return RedirectResponse(url=f"/admin/banners/{banner_type}", status_code=303)


@router.post("/admin/banners/update/{banner_id}")
async def update_banner(
    banner_id: int,
    image_url: str = Form(...),
    link_url: Optional[str] = Form(None),
    alt_text: Optional[str] = Form(None),
    is_active: str = Form("active"),
    image_file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """배너 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    banner = db.query(models.Banner).filter(models.Banner.id == banner_id).first()
    if not banner:
        return HTMLResponse("<script>alert('배너를 찾을 수 없습니다.'); history.back();</script>")
    
    # 파일이 업로드된 경우 처리
    final_image_url = image_url
    if image_file and image_file.filename:
        try:
            # 파일 크기 체크 (5MB)
            file_content = await image_file.read()
            if len(file_content) > 5 * 1024 * 1024:
                return HTMLResponse("<script>alert('파일 크기는 5MB 이하여야 합니다.'); history.back();</script>")
            
            # 이미지 파일만 허용
            if not image_file.content_type or not image_file.content_type.startswith('image/'):
                return HTMLResponse("<script>alert('이미지 파일만 업로드 가능합니다.'); history.back();</script>")
            
            # uploads/banners 디렉토리 생성
            upload_dir = "uploads/banners"
            os.makedirs(upload_dir, exist_ok=True)
            
            # 파일명 생성
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_name = "".join(c for c in image_file.filename if c.isalnum() or c in "._- ") if image_file.filename else "image"
            safe_filename = f"{timestamp}_{safe_name}"
            file_path = os.path.join(upload_dir, safe_filename)
            
            # 파일 저장
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            final_image_url = f"/uploads/banners/{safe_filename}"
        except Exception as e:
            return HTMLResponse(f"<script>alert('이미지 업로드 실패: {str(e)}'); history.back();</script>")
    
    banner.image_url = final_image_url
    banner.link_url = link_url or ""
    banner.alt_text = alt_text or ""
    banner.is_active = is_active
    db.commit()
    
    return RedirectResponse(url=f"/admin/banners/{banner.type}", status_code=303)


@router.get("/admin/banners/delete/{banner_id}")
async def delete_banner(
    banner_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """배너 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    banner = db.query(models.Banner).filter(models.Banner.id == banner_id).first()
    if banner:
        banner_type = banner.type
        db.delete(banner)
        db.commit()
        return RedirectResponse(url=f"/admin/banners/{banner_type}", status_code=303)
    
    return RedirectResponse(url="/admin/dashboard", status_code=303)


@router.post("/admin/banners/update-order")
async def update_banner_order(
    banner_orders: str = Form(...),  # "id1:order1,id2:order2,..." 형식
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """배너 순서 업데이트"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    
    try:
        pairs = banner_orders.split(",")
        for pair in pairs:
            banner_id_str, order_str = pair.split(":")
            banner_id = int(banner_id_str)
            order_index = int(order_str)
            
            banner = db.query(models.Banner).filter(models.Banner.id == banner_id).first()
            if banner:
                banner.order_index = order_index
        
        db.commit()
        return JSONResponse({"success": True, "message": "순서가 업데이트되었습니다."})
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": f"순서 업데이트 실패: {str(e)}"}, status_code=400)

