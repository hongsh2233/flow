"""
대시보드 라우터
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from datetime import datetime, timedelta
import pytz

from app.dependencies import get_current_user
from app.database import get_db
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """관리자 대시보드"""
    if not user:
        return RedirectResponse(url="/")
    
    # 통계 데이터 수집
    stats = {}
    
    # 게시판 통계
    stats['total_boards'] = db.query(models.Board).count()
    stats['total_posts'] = db.query(models.Post).count()
    total_views_result = db.query(func.sum(models.Post.views)).scalar()
    stats['total_views'] = int(total_views_result) if total_views_result else 0
    
    # 회원 통계
    stats['total_members'] = db.query(models.Member).count()
    stats['active_members'] = db.query(models.Member).filter(models.Member.status == 'active').count()
    
    # 일정 통계
    stats['total_schedules'] = db.query(models.Schedule).count()
    _kst = pytz.timezone("Asia/Seoul")
    _now_kst = datetime.now(_kst)
    today = _now_kst.date()
    stats['upcoming_schedules'] = db.query(models.Schedule).filter(models.Schedule.date >= today).count()

    # 관리자 통계
    stats['total_admins'] = db.query(models.AdminUser).count()

    # 금융 데이터 통계
    stats['krx_data_count'] = db.query(models.KrxData).count()
    stats['fsc_data_count'] = db.query(models.FscStockPrice).count()

    # 최근 7일간 게시글 작성 통계 (그래프용)
    seven_days_ago = _now_kst - timedelta(days=7)
    recent_posts = db.query(
        func.date(models.Post.created_at).label('date'),
        func.count(models.Post.id).label('count')
    ).filter(
        models.Post.created_at >= seven_days_ago
    ).group_by(func.date(models.Post.created_at)).all()
    
    post_stats = []
    for i in range(7):
        date = (_now_kst - timedelta(days=6-i)).date()
        count = next((p.count for p in recent_posts if p.date == date), 0)
        post_stats.append({
            'date': date.strftime('%m/%d'),
            'count': count
        })
    
    # 최근 7일간 조회수 통계
    recent_views = db.query(
        func.date(models.Post.updated_at).label('date'),
        func.sum(models.Post.views).label('total_views')
    ).filter(
        models.Post.updated_at >= seven_days_ago
    ).group_by(func.date(models.Post.updated_at)).all()
    
    view_stats = []
    for i in range(7):
        date = (_now_kst - timedelta(days=6-i)).date()
        views_result = next((v.total_views for v in recent_views if v.date == date), None)
        views = int(views_result) if views_result else 0
        view_stats.append({
            'date': date.strftime('%m/%d'),
            'views': views
        })
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "dashboard",
        "stats": stats,
        "post_stats": post_stats,
        "view_stats": view_stats
    })

