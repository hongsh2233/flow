"""
관리자 관리 라우터
"""
from fastapi import APIRouter, Form, Request, Depends, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload
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


# ==================== 메인 페이지 설정 관리 ====================

@router.get("/admin/main", response_class=HTMLResponse)
async def admin_main_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메인 페이지 설정 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    
    items = db.query(models.MainPageItem).order_by(models.MainPageItem.order_index).all()
    
    # datetime-local 입력 필드용 형식 변환 (YYYY-MM-DD HH:MM -> YYYY-MM-DDTHH:MM)
    for item in items:
        if item.start_date:
            item.start_date_display = item.start_date.replace(' ', 'T')[:16] if ' ' in item.start_date else item.start_date + 'T00:00'
        else:
            item.start_date_display = ''
        if item.end_date:
            item.end_date_display = item.end_date.replace(' ', 'T')[:16] if ' ' in item.end_date else item.end_date + 'T23:59'
        else:
            item.end_date_display = ''
    
    return templates.TemplateResponse("admin_main.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "items": items,
        "active_page": "main"
    })


@router.get("/admin/settings", response_class=HTMLResponse)
async def admin_settings_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """설정 페이지 (하단 메뉴 설정 포함)"""
    if not user:
        return RedirectResponse(url="/")

    nav_items = (
        db.query(models.NavMenuItem)
        .options(joinedload(models.NavMenuItem.tabs))
        .order_by(models.NavMenuItem.order_index)
        .all()
    )
    boards = db.query(models.Board).order_by(models.Board.id).all()

    return templates.TemplateResponse("settings.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "active_page": "settings",
        "nav_items": nav_items,
        "boards": boards,
    })


# ==================== 하단 메뉴 설정 CRUD ====================

@router.post("/admin/settings/nav-menu/add")
async def nav_menu_add(
    label: str = Form(...),
    icon: str = Form("icon_home"),
    link_type: str = Form("page"),
    link_value: str = Form(...),
    match_paths: str = Form(""),
    order_index: int = Form(0),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """하단 메뉴 항목 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    item = models.NavMenuItem(
        label=label.strip(),
        icon=icon.strip() or "icon_home",
        link_type=link_type.strip() or "page",
        link_value=link_value.strip(),
        match_paths=match_paths.strip() or None,
        order_index=order_index,
        is_visible="visible",
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/admin/settings", status_code=303)


@router.post("/admin/settings/nav-menu/update/{item_id}")
async def nav_menu_update(
    item_id: int,
    label: str = Form(...),
    icon: str = Form("icon_home"),
    link_type: str = Form("page"),
    link_value: str = Form(...),
    match_paths: str = Form(""),
    order_index: int = Form(0),
    is_visible: str = Form("visible"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """하단 메뉴 항목 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    item = db.query(models.NavMenuItem).filter(models.NavMenuItem.id == item_id).first()
    if not item:
        return HTMLResponse("<script>alert('항목을 찾을 수 없습니다.'); location.href='/admin/settings';</script>")
    item.label = label.strip()
    item.icon = icon.strip() or "icon_home"
    item.link_type = link_type.strip() or "page"
    item.link_value = link_value.strip()
    item.match_paths = match_paths.strip() or None
    item.order_index = order_index
    item.is_visible = is_visible
    db.commit()
    return RedirectResponse(url="/admin/settings", status_code=303)


@router.get("/admin/settings/nav-menu/delete/{item_id}")
async def nav_menu_delete(
    item_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """하단 메뉴 항목 삭제 (하위 탭도 함께 삭제)"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    item = db.query(models.NavMenuItem).filter(models.NavMenuItem.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()
    return RedirectResponse(url="/admin/settings", status_code=303)


@router.post("/admin/settings/nav-menu/update-order")
async def nav_menu_update_order(
    item_orders: str = Form(...),  # "id1:order1,id2:order2,..." 형식
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """하단 메뉴 항목 순서 업데이트"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    try:
        pairs = item_orders.split(",")
        for pair in pairs:
            item_id_str, order_str = pair.split(":")
            item_id = int(item_id_str)
            order_index = int(order_str)
            item = db.query(models.NavMenuItem).filter(models.NavMenuItem.id == item_id).first()
            if item:
                item.order_index = order_index
        db.commit()
        return JSONResponse({"success": True, "message": "순서가 업데이트되었습니다."})
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": f"순서 업데이트 실패: {str(e)}"}, status_code=400)


@router.post("/admin/settings/nav-menu/update-icon/{item_id}")
async def nav_menu_update_icon(
    item_id: int,
    icon: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """하단 메뉴 항목 아이콘만 빠르게 업데이트"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    try:
        item = db.query(models.NavMenuItem).filter(models.NavMenuItem.id == item_id).first()
        if not item:
            return JSONResponse({"success": False, "message": "항목을 찾을 수 없습니다."}, status_code=404)
        item.icon = icon.strip() or "icon_home"
        db.commit()
        return JSONResponse({"success": True, "message": "아이콘이 업데이트되었습니다.", "icon": item.icon})
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": f"아이콘 업데이트 실패: {str(e)}"}, status_code=400)


# ==================== 서브 메뉴/탭 CRUD ====================

@router.post("/admin/settings/nav-menu/{item_id}/tab/add")
async def nav_menu_tab_add(
    item_id: int,
    label: str = Form(...),
    link_type: str = Form("page"),
    link_value: str = Form(...),
    order_index: int = Form(0),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메뉴별 서브 메뉴(탭) 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    item = db.query(models.NavMenuItem).filter(models.NavMenuItem.id == item_id).first()
    if not item:
        return HTMLResponse("<script>alert('메뉴를 찾을 수 없습니다.'); location.href='/admin/settings';</script>")
    tab = models.NavMenuTab(
        nav_menu_item_id=item_id,
        label=label.strip(),
        link_type=link_type.strip() or "page",
        link_value=link_value.strip(),
        order_index=order_index,
        is_visible="visible",
    )
    db.add(tab)
    db.commit()
    return RedirectResponse(url="/admin/settings", status_code=303)


@router.post("/admin/settings/nav-menu/tab/update/{tab_id}")
async def nav_menu_tab_update(
    tab_id: int,
    label: str = Form(...),
    link_type: str = Form("page"),
    link_value: str = Form(...),
    order_index: int = Form(0),
    is_visible: str = Form("visible"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """서브 메뉴(탭) 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    tab = db.query(models.NavMenuTab).filter(models.NavMenuTab.id == tab_id).first()
    if not tab:
        return HTMLResponse("<script>alert('탭을 찾을 수 없습니다.'); location.href='/admin/settings';</script>")
    tab.label = label.strip()
    tab.link_type = link_type.strip() or "page"
    tab.link_value = link_value.strip()
    tab.order_index = order_index
    tab.is_visible = is_visible
    db.commit()
    return RedirectResponse(url="/admin/settings", status_code=303)


@router.get("/admin/settings/nav-menu/tab/delete/{tab_id}")
async def nav_menu_tab_delete(
    tab_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """서브 메뉴(탭) 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    tab = db.query(models.NavMenuTab).filter(models.NavMenuTab.id == tab_id).first()
    if tab:
        db.delete(tab)
        db.commit()
    return RedirectResponse(url="/admin/settings", status_code=303)


@router.post("/admin/main/update-visibility")
async def update_main_item_visibility(
    item_id: int = Form(...),
    is_visible: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메인 페이지 항목 노출 여부 업데이트"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    
    item = db.query(models.MainPageItem).filter(models.MainPageItem.id == item_id).first()
    if not item:
        return JSONResponse({"success": False, "message": "항목을 찾을 수 없습니다."}, status_code=404)
    
    item.is_visible = is_visible
    db.commit()
    
    return JSONResponse({"success": True, "message": "노출 여부가 업데이트되었습니다."})


@router.post("/admin/main/update-period")
async def update_main_item_period(
    item_id: int = Form(...),
    repeat_type: str = Form("none"),
    start_date: str = Form(None),
    end_date: str = Form(None),
    repeat_start_time: str = Form(None),
    repeat_end_time: str = Form(None),
    repeat_days: str = Form(None),
    repeat_next_day: str = Form("false"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메인 페이지 항목 노출 기간 업데이트 (반복 설정 포함)"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)

    item = db.query(models.MainPageItem).filter(models.MainPageItem.id == item_id).first()
    if not item:
        return JSONResponse({"success": False, "message": "항목을 찾을 수 없습니다."}, status_code=404)

    # 반복 타입 설정
    item.repeat_type = repeat_type if repeat_type else "none"

    if repeat_type == "none":
        # 기간 지정 모드: 기존 로직 유지
        item.start_date = start_date if start_date and start_date.strip() else None
        item.end_date = end_date if end_date and end_date.strip() else None

        # 반복 필드 초기화
        item.repeat_start_time = None
        item.repeat_end_time = None
        item.repeat_days = None
        item.repeat_next_day = "false"

        # 날짜/시간 유효성 검사
        if item.start_date and item.end_date:
            try:
                # datetime-local 형식 (YYYY-MM-DDTHH:MM)을 YYYY-MM-DD HH:MM으로 변환
                start_str = item.start_date.replace('T', ' ')
                end_str = item.end_date.replace('T', ' ')

                # 길이에 따라 형식 파악
                if len(start_str) > 10:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M")
                else:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d")

                if len(end_str) > 10:
                    end_dt = datetime.strptime(end_str, "%Y-%m-%d %H:%M")
                else:
                    end_dt = datetime.strptime(end_str, "%Y-%m-%d")

                if start_dt > end_dt:
                    return JSONResponse({"success": False, "message": "시작일시가 종료일시보다 늦을 수 없습니다."}, status_code=400)

                # 저장 형식: YYYY-MM-DD HH:MM
                item.start_date = start_dt.strftime("%Y-%m-%d %H:%M")
                item.end_date = end_dt.strftime("%Y-%m-%d %H:%M")
            except ValueError as e:
                return JSONResponse({"success": False, "message": f"잘못된 날짜 형식입니다: {str(e)}"}, status_code=400)
        elif item.start_date:
            # start_date만 있는 경우 형식 변환
            try:
                start_str = item.start_date.replace('T', ' ')
                if len(start_str) > 10:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M")
                else:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d")
                item.start_date = start_dt.strftime("%Y-%m-%d %H:%M")
            except ValueError:
                pass
        elif item.end_date:
            # end_date만 있는 경우 형식 변환
            try:
                end_str = item.end_date.replace('T', ' ')
                if len(end_str) > 10:
                    end_dt = datetime.strptime(end_str, "%Y-%m-%d %H:%M")
                else:
                    end_dt = datetime.strptime(end_str, "%Y-%m-%d")
                item.end_date = end_dt.strftime("%Y-%m-%d %H:%M")
            except ValueError:
                pass
    else:
        # 반복 모드 (매일/주간): 시간 설정
        if not repeat_start_time or not repeat_end_time:
            return JSONResponse({"success": False, "message": "시작 시간과 종료 시간을 입력해주세요."}, status_code=400)

        # 시간 유효성 검사
        try:
            from datetime import time
            start_time = datetime.strptime(repeat_start_time, "%H:%M").time()
            end_time = datetime.strptime(repeat_end_time, "%H:%M").time()

            # 익일 옵션이 없으면 시작 시간이 종료 시간보다 늦을 수 없음
            if repeat_next_day != "true" and start_time > end_time:
                return JSONResponse({"success": False, "message": "시작 시간이 종료 시간보다 늦을 수 없습니다. 익일까지 옵션을 체크해주세요."}, status_code=400)
        except ValueError as e:
            return JSONResponse({"success": False, "message": f"잘못된 시간 형식입니다: {str(e)}"}, status_code=400)

        item.repeat_start_time = repeat_start_time
        item.repeat_end_time = repeat_end_time
        item.repeat_next_day = repeat_next_day

        # 기간 필드 초기화
        item.start_date = None
        item.end_date = None

        # 주간 반복인 경우 요일 설정
        if repeat_type == "weekly":
            if not repeat_days:
                return JSONResponse({"success": False, "message": "반복 요일을 선택해주세요."}, status_code=400)
            item.repeat_days = repeat_days
        else:
            item.repeat_days = None

    db.commit()

    return JSONResponse({"success": True, "message": "노출 기간이 업데이트되었습니다."})


@router.post("/admin/main/update-order")
async def update_main_item_order(
    item_orders: str = Form(...),  # "id1:order1,id2:order2,..." 형식
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메인 페이지 항목 순서 업데이트"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    
    try:
        # "id1:order1,id2:order2" 형식을 파싱
        pairs = item_orders.split(",")
        for pair in pairs:
            item_id_str, order_str = pair.split(":")
            item_id = int(item_id_str)
            order_index = int(order_str)
            
            item = db.query(models.MainPageItem).filter(models.MainPageItem.id == item_id).first()
            if item:
                item.order_index = order_index
        
        db.commit()
        return JSONResponse({"success": True, "message": "순서가 업데이트되었습니다."})
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": f"순서 업데이트 실패: {str(e)}"}, status_code=400)


@router.post("/admin/main/init-items")
async def init_main_page_items(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메인 페이지 항목 초기화"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    
    try:
        from app.migrations.init_main_page_items import run_migration
        run_migration(db)
        
        # 기존 항목이 있는 경우 누락된 항목 추가
        existing_items = db.query(models.MainPageItem).all()
        
        if existing_items:
            # 최대 order_index 가져오기
            max_order = db.query(func.max(models.MainPageItem.order_index)).scalar()
            if max_order is None:
                max_order = -1
            
            # 관심종목 항목이 없으면 추가
            existing_favorite = db.query(models.MainPageItem).filter(
                models.MainPageItem.component_key == "favorite_stocks"
            ).first()
            
            if not existing_favorite:
                favorite_item = models.MainPageItem(
                    name="관심종목",
                    component_key="favorite_stocks",
                    order_index=max_order + 1,
                    is_visible="visible"
                )
                db.add(favorite_item)
                max_order += 1
            
            # 글로벌 게시판 항목이 없으면 추가
            existing_global = db.query(models.MainPageItem).filter(
                models.MainPageItem.component_key == "global_board"
            ).first()
            
            if not existing_global:
                global_item = models.MainPageItem(
                    name="글로벌",
                    component_key="global_board",
                    order_index=max_order + 1,
                    is_visible="visible"
                )
                db.add(global_item)
            
            db.commit()
        
        return JSONResponse({"success": True, "message": "초기 데이터가 생성되었습니다."})
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": f"초기화 실패: {str(e)}"}, status_code=400)


@router.post("/admin/main/add-missing-items")
async def add_missing_items(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """누락된 메인 페이지 항목 추가"""
    if not user:
        return JSONResponse({"success": False, "message": "인증이 필요합니다."}, status_code=401)
    
    try:
        # 모든 필수 항목 정의
        required_items = [
            {"name": "상단배너관리", "component_key": "top_banner", "order_index": 0},
            {"name": "해외지수", "component_key": "foreign_indices", "order_index": 1},
            {"name": "지수현황", "component_key": "domestic_indices", "order_index": 2},
            {"name": "배너관리", "component_key": "banner", "order_index": 3},
            {"name": "관심종목", "component_key": "favorite_stocks", "order_index": 4},
            {"name": "뉴스관리", "component_key": "news", "order_index": 5},
            {"name": "글로벌", "component_key": "global_board", "order_index": 6},
            {"name": "네이버 랭킹", "component_key": "naver_ranking", "order_index": 7},
        ]
        
        added_count = 0
        
        for item_data in required_items:
            existing = db.query(models.MainPageItem).filter(
                models.MainPageItem.component_key == item_data["component_key"]
            ).first()
            
            if not existing:
                # 최대 order_index 가져오기
                max_order = db.query(func.max(models.MainPageItem.order_index)).scalar()
                if max_order is None:
                    max_order = -1
                
                new_item = models.MainPageItem(
                    name=item_data["name"],
                    component_key=item_data["component_key"],
                    order_index=max_order + 1 if item_data["order_index"] <= max_order else item_data["order_index"],
                    is_visible="visible"
                )
                db.add(new_item)
                added_count += 1
        
        db.commit()
        
        if added_count > 0:
            return JSONResponse({"success": True, "message": f"{added_count}개의 누락된 항목이 추가되었습니다."})
        else:
            return JSONResponse({"success": True, "message": "추가할 항목이 없습니다. 모든 항목이 이미 존재합니다."})
            
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": f"항목 추가 실패: {str(e)}"}, status_code=400)


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
        return RedirectResponse(url="/admin/main")
    
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
        "active_page": "main"
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
    
    return RedirectResponse(url="/admin/main", status_code=303)


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

