"""
투표 관리 라우터 - 게시판과 분리된 별도 투표 모듈
"""
from fastapi import APIRouter, Form, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import date as date_type
from typing import List, Optional

from app.dependencies import get_current_user
from app.database import get_db
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/polls", response_class=HTMLResponse)
async def polls_list_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투표 목록 페이지 (진행중인 투표)"""
    if not user:
        return RedirectResponse(url="/")

    today = date_type.today()
    polls = (
        db.query(models.Poll)
        .order_by(models.Poll.start_date.desc(), models.Poll.id.desc())
        .all()
    )

    poll_list = []
    for p in polls:
        is_active = p.start_date <= today <= p.end_date
        status = "진행중" if is_active else ("예정" if p.start_date > today else "종료")
        poll_list.append({
            "id": p.id,
            "title": p.title,
            "description": (p.description or "")[:100],
            "start_date": p.start_date.isoformat() if p.start_date else "",
            "end_date": p.end_date.isoformat() if p.end_date else "",
            "status": status,
            "is_active": is_active,
            "option_count": len(p.options) if p.options else 0,
            "total_votes": sum(
                v.vote_count for v in (p.votes or [])
            ),
        })

    return templates.TemplateResponse("admin_polls.html", {
        "request": request,
        "admin_email": user.email,
        "polls": poll_list,
        "active_page": "polls",
    })


@router.get("/admin/polls/create", response_class=HTMLResponse)
async def poll_create_page(
    request: Request,
    user=Depends(get_current_user),
):
    """투표 등록 폼"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("admin_poll_write.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "polls",
        "poll": None,
    })


@router.post("/admin/polls/create")
async def poll_create(
    title: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    description: str = Form(None),
    option_1: str = Form(None),
    option_2: str = Form(None),
    option_3: str = Form(None),
    option_4: str = Form(None),
    option_5: str = Form(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투표 등록"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    title = (title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="제목은 필수입니다.")

    try:
        start_d = date_type.fromisoformat(start_date.strip())
        end_d = date_type.fromisoformat(end_date.strip())
        if end_d < start_d:
            raise HTTPException(status_code=400, detail="종료일은 시작일 이후여야 합니다.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    options_raw = [option_1, option_2, option_3, option_4, option_5]
    options_text = [o.strip() for o in options_raw if o and o.strip()]

    if len(options_text) < 2:
        raise HTTPException(status_code=400, detail="선택지는 최소 2개 이상 필요합니다.")

    poll = models.Poll(
        title=title,
        description=(description or "").strip() or None,
        start_date=start_d,
        end_date=end_d,
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)

    for idx, text in enumerate(options_text):
        opt = models.PollOption(
            poll_id=poll.id,
            text=text,
            order_index=idx,
        )
        db.add(opt)
    db.commit()

    return RedirectResponse(url="/admin/polls", status_code=303)


@router.get("/admin/polls/{poll_id}/edit", response_class=HTMLResponse)
async def poll_edit_page(
    request: Request,
    poll_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투표 수정 폼"""
    if not user:
        return RedirectResponse(url="/")

    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="투표를 찾을 수 없습니다.")

    options = sorted(poll.options or [], key=lambda o: o.order_index)
    option_values = [o.text for o in options]
    while len(option_values) < 5:
        option_values.append("")

    return templates.TemplateResponse("admin_poll_write.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "polls",
        "poll": poll,
        "option_values": option_values,
        "is_edit": True,
    })


@router.post("/admin/polls/{poll_id}/edit")
async def poll_edit(
    poll_id: int,
    title: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    description: str = Form(None),
    option_1: str = Form(None),
    option_2: str = Form(None),
    option_3: str = Form(None),
    option_4: str = Form(None),
    option_5: str = Form(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투표 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="투표를 찾을 수 없습니다.")

    title = (title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="제목은 필수입니다.")

    try:
        start_d = date_type.fromisoformat(start_date.strip())
        end_d = date_type.fromisoformat(end_date.strip())
        if end_d < start_d:
            raise HTTPException(status_code=400, detail="종료일은 시작일 이후여야 합니다.")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    options_raw = [option_1, option_2, option_3, option_4, option_5]
    options_text = [o.strip() for o in options_raw if o and o.strip()]

    if len(options_text) < 2:
        raise HTTPException(status_code=400, detail="선택지는 최소 2개 이상 필요합니다.")

    poll.title = title
    poll.description = (description or "").strip() or None
    poll.start_date = start_d
    poll.end_date = end_d

    # 기존 옵션 삭제 후 재생성 (옵션 순서 변경 시 vote_count 인덱스가 꼬일 수 있으나, 새 구조에서는 option_index로 매핑)
    for opt in list(poll.options or []):
        db.delete(opt)
    db.commit()

    for idx, text in enumerate(options_text):
        opt = models.PollOption(
            poll_id=poll.id,
            text=text,
            order_index=idx,
        )
        db.add(opt)
    db.commit()

    return RedirectResponse(url="/admin/polls", status_code=303)


@router.post("/admin/polls/{poll_id}/delete")
async def poll_delete(
    poll_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투표 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="투표를 찾을 수 없습니다.")

    db.delete(poll)
    db.commit()
    return RedirectResponse(url="/admin/polls", status_code=303)
