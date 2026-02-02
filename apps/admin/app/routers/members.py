"""
회원 관리 라우터
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime

from app.dependencies import get_current_user
from app.database import get_db
from app.config import ADMIN_EMAIL
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/members", response_class=HTMLResponse)
async def admin_members_page(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """회원 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    
    try:
        # DB에서 회원 목록 조회
        db_members = db.query(models.Member).order_by(models.Member.created_at.desc()).all()
        
        # 게시글/댓글 수는 추후 구현 (현재는 0으로 표시)
        members = []
        for m in db_members:
            # Post 테이블에서 해당 회원의 게시글 수 계산
            post_count = db.query(models.Post).filter(models.Post.author == m.email).count()
            # 댓글 수는 추후 구현 (현재는 0)
            comment_count = 0
            
            members.append({
                "id": m.id,
                "name": m.name,
                "nickname": m.nickname,  # 닉네임 추가
                "email": m.email,
                "provider": m.provider,
                "profile_image": m.profile_image,  # 프로필 이미지 추가
                "join_date": m.created_at.strftime("%Y-%m-%d") if m.created_at else "",
                "status": m.status,
                "posts": post_count,
                "comments": comment_count
            })
        
        return templates.TemplateResponse("members.html", {
            "request": request,
            "admin_email": ADMIN_EMAIL,
            "members": members,
            "active_page": "members"
        })
    except Exception as e:
        # 에러 발생 시 상세 정보 출력
        import traceback
        error_detail = traceback.format_exc()
        print(f"[ERROR] 회원 관리 페이지 오류: {str(e)}")
        print(f"[ERROR] 상세 정보:\n{error_detail}")
        
        # 에러 페이지 반환 또는 빈 목록 반환
        return templates.TemplateResponse("members.html", {
            "request": request,
            "admin_email": ADMIN_EMAIL,
            "members": [],
            "active_page": "members",
            "error": f"데이터베이스 오류가 발생했습니다: {str(e)}"
        })


@router.get("/admin/members/status/{member_id}")
async def toggle_member_status(member_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """회원 상태 토글 (정지/활성화)"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if member:
        member.status = "blocked" if member.status == "active" else "active"
        db.commit()
    
    return RedirectResponse(url="/admin/members", status_code=303)

