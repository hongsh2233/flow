"""
일정 관리 라우터
"""
from fastapi import APIRouter, Form, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import date as date_type
from typing import List, Dict, Any
from urllib.parse import quote

from app.dependencies import get_current_user
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
            "end_date": s.end_date.isoformat() if getattr(s, "end_date", None) else "",
            "scheduled_time": getattr(s, "scheduled_time", None) or "",
            "subject": s.subject,
            "content": s.content or "",
            "detail": getattr(s, "detail", None) or "",
            "type": s.type,
            "link_url": getattr(s, "link_url", None) or "",
            "underwriter": getattr(s, "underwriter", None) or "",
            "show_main_popup": getattr(s, "show_main_popup", False) or False,
        }
        for s in schedules
    ]
    
    return templates.TemplateResponse("schedule.html", {
        "request": request,
        "admin_email": user.email,
        "schedules": schedule_list,
        "active_page": "schedule"
    })


VALID_SCHEDULE_TYPES = {"api", "earnings", "ipo", "dividend", "news", "etc", "manual", "naver_cal", "krx"}


@router.post("/admin/schedule/add")
async def add_schedule(
    date: str = Form(...),
    end_date: str = Form(None),
    scheduled_time: str = Form(None),
    subject: str = Form(...),
    content: str = Form(None),
    detail: str = Form(None),
    link_url: str = Form(None),
    schedule_type_param: str = Form("etc"),
    show_main_popup: str = Form("false"),
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
        date_obj = date_type.fromisoformat(date)
        end_date_obj = None
        if end_date and end_date.strip():
            end_date_obj = date_type.fromisoformat(end_date.strip())
            if end_date_obj < date_obj:
                raise HTTPException(status_code=400, detail="종료일은 시작일 이후여야 합니다.")
        
        link_url_val = (link_url or "").strip() or None
        new_schedule = models.Schedule(
            date=date_obj,
            end_date=end_date_obj,
            scheduled_time=time_val,
            subject=subject,
            content=content or "",
            detail=detail or None,
            type=schedule_type,
            link_url=link_url_val,
            underwriter=None,
            show_main_popup=show_main_popup.lower() in ("true", "1", "on", "yes"),
        )
        
        db.add(new_schedule)
        db.commit()
        db.refresh(new_schedule)

        # 알림은 사용자가 직접 알림설정(schedule-alarm)할 때만 발송
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
    end_date: str = Form(None),
    scheduled_time: str = Form(None),
    subject: str = Form(...),
    content: str = Form(None),
    detail: str = Form(None),
    link_url: str = Form(None),
    schedule_type_param: str = Form("etc"),
    show_main_popup: str = Form("false"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """일정 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    schedule = db.query(models.Schedule).filter(models.Schedule.id == sch_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    
    schedule_type = schedule_type_param if schedule_type_param in VALID_SCHEDULE_TYPES else schedule.type or "etc"
    time_val = (scheduled_time or "").strip() or None
    if time_val and not _valid_time(time_val):
        time_val = None
    
    try:
        date_obj = date_type.fromisoformat(date)
        end_date_obj = None
        if end_date and end_date.strip():
            end_date_obj = date_type.fromisoformat(end_date.strip())
            if end_date_obj < date_obj:
                raise HTTPException(status_code=400, detail="종료일은 시작일 이후여야 합니다.")
        
        schedule.date = date_obj
        schedule.end_date = end_date_obj
        schedule.scheduled_time = time_val
        schedule.subject = subject
        schedule.content = content or ""
        schedule.detail = detail or None
        schedule.type = schedule_type
        schedule.link_url = (link_url or "").strip() or None
        schedule.show_main_popup = show_main_popup.lower() in ("true", "1", "on", "yes")

        db.commit()
        db.refresh(schedule)
        
        return RedirectResponse(url="/admin/schedule", status_code=303)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"잘못된 날짜 형식: {e}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"일정 수정 실패: {str(e)}")


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


@router.post("/admin/schedule/sync-naver-calendar")
async def sync_naver_calendar_schedule(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """네이버 증권 증시 캘린더(이번 달·다음 달) 수집 후 일정 등록"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    from datetime import datetime
    import pytz
    from app.engine.services.naver_calendar_service import naver_calendar_service

    kst = pytz.timezone("Asia/Seoul")
    now = datetime.now(kst)
    total_fetched = 0
    total_saved = 0
    try:
        for month_offset in (0, 1):
            target_month = now.month + month_offset
            target_year = now.year
            while target_month > 12:
                target_month -= 12
                target_year += 1
            schedules = await naver_calendar_service.fetch_monthly_schedule(target_year, target_month)
            total_fetched += len(schedules)
            if schedules:
                total_saved += naver_calendar_service.save_schedules_to_db(db, schedules)
        return RedirectResponse(
            url=(
                f"/admin/schedule?naver_cal=ok"
                f"&naver_fetched={total_fetched}&naver_saved={total_saved}"
            ),
            status_code=303,
        )
    except Exception as e:
        db.rollback()
        return RedirectResponse(
            url=f"/admin/schedule?naver_cal=err&msg={quote(str(e)[:200], safe='')}",
            status_code=303,
        )


@router.post("/admin/schedule/sync-krx-ipo")
async def sync_krx_ipo_schedule(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """KRX KIND 공모·상장 일정 수집 후 일정 등록"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    from app.engine.services.krx_kind_service import krx_kind_service

    try:
        rows = await krx_kind_service.fetch_ipo_schedules()
        if rows:
            krx_kind_service.save_schedules_to_db(db, rows)
        return RedirectResponse(
            url=f"/admin/schedule?krx=ok&krx_count={len(rows)}",
            status_code=303,
        )
    except Exception as e:
        db.rollback()
        return RedirectResponse(
            url=f"/admin/schedule?krx=err&msg={quote(str(e)[:200], safe='')}",
            status_code=303,
        )
