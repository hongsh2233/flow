"""
일정 관리 라우터
"""
from fastapi import APIRouter, Form, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import date as date_type
from typing import List, Dict, Any

from app.dependencies import get_current_user
from app.config import ADMIN_EMAIL
from app.database import get_db
from app import models
from app.services.schedule_api_service import schedule_api_service

router = APIRouter()


def _valid_time(s: str) -> bool:
    """HH:mm 형식 검증"""
    if not s or len(s) != 5:
        return False
    parts = s.split(":")
    if len(parts) != 2:
        return False
    try:
        h, m = int(parts[0]), int(parts[1])
        return 0 <= h <= 23 and 0 <= m <= 59
    except ValueError:
        return False
templates = Jinja2Templates(directory="dashboard/templates")

# --- 프론트엔드 호출용 API 엔드포인트는 api.py에서 통합 관리 ---
# /api/schedules 엔드포인트는 api.py의 get_schedules()에서 처리
# (query parameter 지원: start_date, end_date, type)

# --- 기존 관리자 페이지용 로직 (유지) ---

@router.get("/admin/schedule", response_class=HTMLResponse)
async def schedule_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자용 일정 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    
    schedules = db.query(models.Schedule).order_by(models.Schedule.date).all()
    
    schedule_list = [
        {
            "id": s.id,
            "date": s.date.isoformat() if s.date else None,
            "scheduled_time": getattr(s, "scheduled_time", None) or "",
            "subject": s.subject,
            "content": s.content or "",
            "detail": getattr(s, "detail", None) or "",
            "type": s.type
            "underwriter": getattr(s, "underwriter", None) or "",
        }
        for s in schedules
    ]
    
    return templates.TemplateResponse("schedule.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "schedules": schedule_list,
        "active_page": "schedule"
    })


VALID_SCHEDULE_TYPES = {"api", "earnings", "ipo", "dividend", "news", "etc", "manual"}


@router.post("/admin/schedule/add")
async def add_schedule(
    date: str = Form(...),
    scheduled_time: str = Form(None),
    subject: str = Form(...),
    content: str = Form(None),
    detail: str = Form(None),
    link_url: str = Form(None),
    underwriter: str = Form(None),
    schedule_type_param: str = Form("etc"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """일정 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    schedule_type = schedule_type_param if schedule_type_param in VALID_SCHEDULE_TYPES else "etc"
    time_val = (scheduled_time or "").strip() or None
    if time_val and not _valid_time(time_val):
        time_val = None
    
    try:
        # 날짜 문자열을 date 객체로 변환
        date_obj = date_type.fromisoformat(date)
        
        # 새 일정 생성
        link_val = (link_url or "").strip() or None
        underwriter_val = (underwriter or "").strip() or None
        new_schedule = models.Schedule(
            date=date_obj,
            scheduled_time=time_val,
            subject=subject,
            content=content or "",
            detail=detail or None,
            link_url=link_val,
            underwriter=underwriter_val,
            type=schedule_type
        )
        
        db.add(new_schedule)
        db.commit()
        db.refresh(new_schedule)
        
        return RedirectResponse(url="/admin/schedule", status_code=303)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"잘못된 날짜 형식: {e}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"일정 추가 실패: {str(e)}")


@router.get("/admin/schedule/delete/{sch_id}")
async def delete_schedule(
    sch_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """일정 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    # 일정 조회
    schedule = db.query(models.Schedule).filter(models.Schedule.id == sch_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    
    try:
        db.delete(schedule)
        db.commit()
        return RedirectResponse(url="/admin/schedule", status_code=303)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"일정 삭제 실패: {str(e)}")


@router.post("/admin/schedule/update")
async def update_schedule(
    sch_id: int = Form(...),
    date: str = Form(...),
    scheduled_time: str = Form(None),
    subject: str = Form(...),
    content: str = Form(None),
    detail: str = Form(None),
    link_url: str = Form(None),
    underwriter: str = Form(None),
    schedule_type_param: str = Form("etc"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """일정 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    # 일정 조회
    schedule = db.query(models.Schedule).filter(models.Schedule.id == sch_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    
    schedule_type = schedule_type_param if schedule_type_param in VALID_SCHEDULE_TYPES else schedule.type or "etc"
    time_val = (scheduled_time or "").strip() or None
    if time_val and not _valid_time(time_val):
        time_val = None
    
    try:
        # 날짜 문자열을 date 객체로 변환
        date_obj = date_type.fromisoformat(date)
        
        # 일정 정보 업데이트
        schedule.date = date_obj
        schedule.scheduled_time = time_val
        schedule.subject = subject
        schedule.content = content or ""
        schedule.detail = detail or None
        schedule.link_url = (link_url or "").strip() or None
        schedule.underwriter = (underwriter or "").strip() or None
        schedule.type = schedule_type
        
        db.commit()
        db.refresh(schedule)
        
        return RedirectResponse(url="/admin/schedule", status_code=303)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"잘못된 날짜 형식: {e}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"일정 수정 실패: {str(e)}")


@router.post("/admin/schedule/sync-ipo-38")
async def sync_ipo_schedule_38(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """38커뮤니케이션(38.co.kr)에서 공모청약 일정 크롤링 후 DB 저장 (공모청약 타입)"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    try:
        from app.services.ipo_schedule_crawler import fetch_ipo_schedules_38
        items = await fetch_ipo_schedules_38(max_pages=5)
        if not items:
            return RedirectResponse(url="/admin/schedule?error=ipo_sync&reason=no_data", status_code=303)
        # 기존 ipo 일정 중 (date, subject) 세트로 중복 체크
        existing_ipo = db.query(models.Schedule).filter(models.Schedule.type == "ipo").all()
        existing_keys = {(s.date, (s.subject or "").strip()) for s in existing_ipo}
        added_count = 0
        skipped_count = 0
        for item in items:
            start_date = item.get("date")
            if not start_date:
                skipped_count += 1
                continue
            company = (item.get("company_name") or "").strip()
            if not company:
                skipped_count += 1
                continue
            subject = f"{company} 청약"
            period = item.get("period") or ""
            price = item.get("price") or ""
            underwriter = (item.get("underwriter") or "").strip()
            content = f"{period} / {price} / {underwriter}".strip(" /")
            if (start_date, subject) in existing_keys:
                skipped_count += 1
                continue
            new_schedule = models.Schedule(
                date=start_date,
                subject=subject,
                content=content,
                type="ipo",
                underwriter=underwriter or None,
            )
            db.add(new_schedule)
            existing_keys.add((start_date, subject))
            added_count += 1
        db.commit()
        redirect_url = f"/admin/schedule?success=true&ipo_added={added_count}&ipo_skipped={skipped_count}"
        return RedirectResponse(url=redirect_url, status_code=303)
    except Exception as e:
        if db:
            db.rollback()
        print(f"[IPO 동기화] 38.co.kr 크롤링 실패: {e}")
        import traceback
        traceback.print_exc()
        return RedirectResponse(url="/admin/schedule?error=ipo_sync&reason=exception", status_code=303)


@router.post("/admin/schedule/sync-api")
async def sync_api_schedule(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """공공데이터포털 API에서 공휴일 정보 동기화"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    try:
        # 외부 API에서 공휴일 데이터 가져오기
        api_items = await schedule_api_service.fetch_schedules_from_api()
        
        if not api_items:
            # API 키 확인 및 상세 오류 정보 제공
            from app.config import DATA_GO_KR_API_KEY
            if not DATA_GO_KR_API_KEY:
                return RedirectResponse(url="/admin/schedule?error=no_data&reason=no_api_key", status_code=303)
            return RedirectResponse(url="/admin/schedule?error=no_data&reason=api_failed", status_code=303)
        
        # 기존 일정 중 같은 날짜의 API 일정 조회 (중복 방지)
        existing_dates = set()
        existing_schedules = db.query(models.Schedule).filter(
            models.Schedule.type == "api"
        ).all()
        for schedule in existing_schedules:
            existing_dates.add(schedule.date)
        
        added_count = 0
        skipped_count = 0
        
        # 가져온 데이터를 DB에 저장
        for item in api_items:
            try:
                # 날짜 문자열을 date 객체로 변환
                date_obj = date_type.fromisoformat(item['date']) if isinstance(item['date'], str) else item['date']
                
                # 중복 체크: 같은 날짜의 API 일정이 이미 있으면 건너뛰기
                if date_obj in existing_dates:
                    skipped_count += 1
                    continue
                
                # API 데이터에서 subject와 content 추출
                subject = item.get('subject') or item.get('title', '공휴일')
                content = item.get('content', '')
                
                new_schedule = models.Schedule(
                    date=date_obj,
                    subject=subject,
                    content=content,
                    type="api"
                )
                db.add(new_schedule)
                existing_dates.add(date_obj)  # 추가한 날짜도 중복 체크에 포함
                added_count += 1
            except (ValueError, KeyError) as e:
                print(f"일정 항목 처리 실패: {item}, 오류: {e}")
                continue
        
        db.commit()
        
        # 결과 메시지와 함께 리다이렉트
        redirect_url = f"/admin/schedule?success=true&added={added_count}&skipped={skipped_count}"
        return RedirectResponse(url=redirect_url, status_code=303)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"API 동기화 실패: {str(e)}")

