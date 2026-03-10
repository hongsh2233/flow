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
import json
from datetime import datetime

from app import models, utils
from app.database import get_db
from app.dependencies import get_current_user

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
        "admin_email": user.email,
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
    target_user = db.query(models.AdminUser).filter(models.AdminUser.email == email).first()
    if target_user and target_user.is_super_admin:
        return HTMLResponse("<script>alert('최고 관리자 계정은 삭제할 수 없습니다.'); location.href='/admin/users';</script>")
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
        "admin_email": user.email,
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
            
            from app.config import UPLOADS_DIR
            upload_dir = UPLOADS_DIR / "banners"
            upload_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_name = "".join(c for c in image_file.filename if c.isalnum() or c in "._- ") if image_file.filename else "image"
            safe_filename = f"{timestamp}_{safe_name}"
            file_path = upload_dir / safe_filename
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
            
            from app.config import UPLOADS_DIR
            upload_dir = UPLOADS_DIR / "banners"
            upload_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_name = "".join(c for c in image_file.filename if c.isalnum() or c in "._- ") if image_file.filename else "image"
            safe_filename = f"{timestamp}_{safe_name}"
            file_path = upload_dir / safe_filename
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


# ==================== 배너관리 (신규) ====================

def _parse_page_paths(s: Optional[str]) -> list:
    if not s or not s.strip():
        return []
    try:
        arr = json.loads(s)
        return arr if isinstance(arr, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _banner_with_paths(banner):
    """Banner 객체에 page_paths_list 속성 추가"""
    banner.page_paths_list = _parse_page_paths(getattr(banner, "page_paths", None))
    return banner


@router.get("/admin/banner-manage", response_class=HTMLResponse)
async def admin_banner_manage_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """배너관리 페이지 (1개형/슬라이드형, 이미지/HTML)"""
    if not user:
        return RedirectResponse(url="/")
    banners = (
        db.query(models.Banner)
        .filter(models.Banner.type == "managed")
        .order_by(models.Banner.order_index)
        .all()
    )
    for b in banners:
        _banner_with_paths(b)
    # 슬라이드 그룹 목록 (managed 타입 중 slide인 것의 slide_group)
    slide_groups = list(
        {
            b.slide_group
            for b in db.query(models.Banner)
            .filter(models.Banner.type == "managed", models.Banner.display_type == "slide", models.Banner.slide_group.isnot(None))
            .all()
            if b.slide_group
        }
    )
    base_url = str(request.base_url).rstrip("/") if request else ""
    return templates.TemplateResponse("admin_banner_manage.html", {
        "request": request,
        "admin_email": user.email,
        "banners": banners,
        "slide_groups": sorted(slide_groups),
        "active_page": "banner-manage",
        "site_base_url": base_url,
    })


@router.post("/admin/banner-manage/add")
async def add_managed_banner(
    display_type: str = Form("single"),
    content_type: str = Form("image"),
    image_url: Optional[str] = Form(None),
    html_content: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    page_paths: str = Form(...),
    slide_group: Optional[str] = Form(None),
    position: str = Form("top"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    paths = _parse_page_paths(page_paths)
    if not paths:
        return HTMLResponse("<script>alert('노출 페이지 경로를 1개 이상 추가해주세요.'); history.back();</script>")
    if content_type == "image":
        final_image_url = (image_url or "").strip()
        if not final_image_url:
            return HTMLResponse("<script>alert('이미지 URL을 입력해주세요.'); history.back();</script>")
        html_content = None
    else:
        html_content = (html_content or "").strip()
        if not html_content:
            return HTMLResponse("<script>alert('HTML 내용을 입력해주세요.'); history.back();</script>")
        final_image_url = None
    sg = slide_group.strip() if slide_group and display_type == "slide" else None
    if display_type == "slide" and not sg:
        sg = f"slide_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    last = db.query(models.Banner).filter(models.Banner.type == "managed").order_by(models.Banner.order_index.desc()).first()
    next_order = (last.order_index + 1) if last else 0
    new_banner = models.Banner(
        type="managed",
        display_type=display_type or "single",
        content_type=content_type or "image",
        image_url=final_image_url,
        html_content=html_content,
        link_url=link_url or "",
        page_paths=json.dumps(paths),
        slide_group=sg,
        order_index=next_order,
        is_active="active",
        position=position if position in ("top", "bottom") else "top",
    )
    db.add(new_banner)
    db.commit()
    return RedirectResponse(url="/admin/banner-manage", status_code=303)


@router.get("/admin/banner-manage/edit/{banner_id}", response_class=HTMLResponse)
async def edit_managed_banner_page(
    banner_id: int,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user:
        return RedirectResponse(url="/")
    banner = db.query(models.Banner).filter(models.Banner.id == banner_id, models.Banner.type == "managed").first()
    if not banner:
        return RedirectResponse(url="/admin/banner-manage")
    _banner_with_paths(banner)
    slide_groups = list(
        {
            b.slide_group
            for b in db.query(models.Banner)
            .filter(models.Banner.type == "managed", models.Banner.display_type == "slide", models.Banner.slide_group.isnot(None))
            .all()
            if b.slide_group
        }
    )
    if banner.slide_group and banner.slide_group not in slide_groups:
        slide_groups.append(banner.slide_group)
    base_url = str(request.base_url).rstrip("/") if request else ""
    return templates.TemplateResponse("admin_banner_edit.html", {
        "request": request,
        "admin_email": user.email,
        "banner": banner,
        "slide_groups": sorted(slide_groups),
        "active_page": "banner-manage",
        "site_base_url": base_url,
    })


@router.post("/admin/banner-manage/update/{banner_id}")
async def update_managed_banner(
    banner_id: int,
    display_type: str = Form("single"),
    content_type: str = Form("image"),
    image_url: Optional[str] = Form(None),
    html_content: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    page_paths: str = Form(...),
    slide_group: Optional[str] = Form(None),
    is_active: str = Form("active"),
    position: str = Form("top"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    banner = db.query(models.Banner).filter(models.Banner.id == banner_id, models.Banner.type == "managed").first()
    if not banner:
        return RedirectResponse(url="/admin/banner-manage")
    paths = _parse_page_paths(page_paths)
    if not paths:
        return HTMLResponse("<script>alert('노출 페이지 경로를 1개 이상 추가해주세요.'); history.back();</script>")
    if content_type == "image":
        final_image_url = (image_url or "").strip()
        if not final_image_url and not banner.image_url:
            return HTMLResponse("<script>alert('이미지 URL을 입력해주세요.'); history.back();</script>")
        banner.image_url = final_image_url or banner.image_url
        banner.html_content = None
    else:
        html_content = (html_content or "").strip()
        if not html_content:
            return HTMLResponse("<script>alert('HTML 내용을 입력해주세요.'); history.back();</script>")
        banner.html_content = html_content
        banner.image_url = None
    banner.display_type = display_type or "single"
    banner.content_type = content_type or "image"
    banner.link_url = link_url or ""
    banner.page_paths = json.dumps(paths)
    banner.is_active = is_active
    banner.position = position if position in ("top", "bottom") else "top"
    if display_type == "slide":
        banner.slide_group = (slide_group or "").strip() or f"slide_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    else:
        banner.slide_group = None
    db.commit()
    return RedirectResponse(url="/admin/banner-manage", status_code=303)


@router.get("/admin/banner-manage/delete/{banner_id}")
async def delete_managed_banner(
    banner_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    banner = db.query(models.Banner).filter(models.Banner.id == banner_id, models.Banner.type == "managed").first()
    if banner:
        db.delete(banner)
        db.commit()
    return RedirectResponse(url="/admin/banner-manage", status_code=303)

