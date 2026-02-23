"""
회원 관리 라우터
"""
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime, timezone

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
            
            # 만료된 등급은 regular로 표시
            grade = getattr(m, "grade", "regular") or "regular"
            grade_expires_at = getattr(m, "grade_expires_at", None)
            if grade != "regular" and grade_expires_at:
                expires_naive = grade_expires_at.replace(tzinfo=None) if grade_expires_at.tzinfo else grade_expires_at
                if expires_naive < datetime.utcnow():
                    grade = "regular"

            members.append({
                "id": m.id,
                "name": m.name,
                "nickname": m.nickname,
                "email": m.email,
                "provider": m.provider,
                "profile_image": m.profile_image,
                "join_date": m.created_at.strftime("%Y-%m-%d") if m.created_at else "",
                "status": m.status,
                "grade": grade,
                "grade_expires_at": grade_expires_at.strftime("%Y-%m-%d") if grade_expires_at else "",
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


@router.post("/admin/members/grade/{member_id}")
async def set_member_grade(
    member_id: int,
    grade: str = Form(...),
    grade_expires_at: str = Form(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """회원 등급 변경 (regular / vip / family) + 만료일 설정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    if grade not in ("regular", "vip", "family"):
        return RedirectResponse(url="/admin/members", status_code=303)

    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if member:
        member.grade = grade
        if grade == "regular" or not grade_expires_at or grade_expires_at.strip() == "":
            member.grade_expires_at = None
        else:
            try:
                # 날짜 문자열(YYYY-MM-DD)을 datetime으로 변환 (UTC 자정 기준)
                member.grade_expires_at = datetime.strptime(grade_expires_at.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                member.grade_expires_at = None
        db.commit()

    return RedirectResponse(url="/admin/members", status_code=303)

