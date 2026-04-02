"""
BO 이벤트 정책(bo_events) 관리
"""
import json
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")
KST = pytz.timezone("Asia/Seoul")


def _parse_optional_dt(raw: Optional[str]) -> Optional[datetime]:
    if not raw or not str(raw).strip():
        return None
    s = str(raw).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = KST.localize(dt)
        return dt
    except ValueError:
        return None


def _parse_json_obj(raw: Optional[str]) -> Optional[dict]:
    if not raw or not str(raw).strip():
        return None
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else None
    except json.JSONDecodeError:
        return None


def _non_negative_int_form(raw: Optional[str], default: int = 0) -> int:
    if raw is None or not str(raw).strip():
        return default
    try:
        return max(0, int(str(raw).strip()))
    except ValueError:
        return default


@router.get("/admin/events", response_class=HTMLResponse)
async def admin_events_list(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")

    events = db.query(models.BoEvent).order_by(models.BoEvent.id.desc()).all()
    counts_rows = (
        db.query(models.BoEventParticipation.event_id, func.count(models.BoEventParticipation.id))
        .group_by(models.BoEventParticipation.event_id)
        .all()
    )
    part_counts = {eid: c for eid, c in counts_rows}

    return templates.TemplateResponse(
        "admin_bo_events.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "events",
            "events": events,
            "part_counts": part_counts,
        },
    )


@router.get("/admin/events/new", response_class=HTMLResponse)
async def admin_events_new(
    request: Request,
    user=Depends(get_current_user),
):
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "admin_bo_events_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "events",
            "event": None,
            "trigger_json": "",
        },
    )


@router.get("/admin/events/{event_id}/edit", response_class=HTMLResponse)
async def admin_events_edit(
    event_id: int,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    ev = db.query(models.BoEvent).filter(models.BoEvent.id == event_id).first()
    if not ev:
        return RedirectResponse(url="/admin/events", status_code=303)
    tj = ""
    if ev.trigger_condition:
        try:
            tj = json.dumps(ev.trigger_condition, ensure_ascii=False, indent=2)
        except TypeError:
            tj = str(ev.trigger_condition)
    return templates.TemplateResponse(
        "admin_bo_events_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "events",
            "event": ev,
            "trigger_json": tj,
        },
    )


@router.post("/admin/events/add")
async def admin_events_add(
    name: str = Form(...),
    event_type: str = Form(...),
    description: str = Form(""),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    max_participants: Optional[str] = Form(None),
    is_active: Optional[str] = Form(None),
    benefit_type: str = Form(...),
    benefit_grade: str = Form("vip"),
    benefit_days: str = Form("0"),
    trigger_condition_json: str = Form(""),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    mx = None
    if max_participants and str(max_participants).strip().isdigit():
        mx = int(max_participants)
    ev = models.BoEvent(
        name=name.strip(),
        event_type=event_type.strip(),
        description=description.strip() or None,
        start_date=_parse_optional_dt(start_date),
        end_date=_parse_optional_dt(end_date),
        is_active=bool(is_active),
        max_participants=mx,
        benefit_type=benefit_type.strip(),
        benefit_grade=benefit_grade.strip() or "vip",
        benefit_days=_non_negative_int_form(benefit_days, 0),
        trigger_condition=_parse_json_obj(trigger_condition_json),
    )
    db.add(ev)
    db.commit()
    return RedirectResponse(url="/admin/events", status_code=303)


@router.post("/admin/events/{event_id}/edit")
async def admin_events_update(
    event_id: int,
    name: str = Form(...),
    event_type: str = Form(...),
    description: str = Form(""),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    max_participants: Optional[str] = Form(None),
    is_active: Optional[str] = Form(None),
    benefit_type: str = Form(...),
    benefit_grade: str = Form("vip"),
    benefit_days: str = Form("0"),
    trigger_condition_json: str = Form(""),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    ev = db.query(models.BoEvent).filter(models.BoEvent.id == event_id).first()
    if not ev:
        return RedirectResponse(url="/admin/events", status_code=303)
    mx = None
    if max_participants and str(max_participants).strip().isdigit():
        mx = int(max_participants)
    ev.name = name.strip()
    ev.event_type = event_type.strip()
    ev.description = description.strip() or None
    ev.start_date = _parse_optional_dt(start_date)
    ev.end_date = _parse_optional_dt(end_date)
    ev.is_active = bool(is_active)
    ev.max_participants = mx
    ev.benefit_type = benefit_type.strip()
    ev.benefit_grade = benefit_grade.strip() or "vip"
    ev.benefit_days = _non_negative_int_form(benefit_days, 0)
    ev.trigger_condition = _parse_json_obj(trigger_condition_json)
    db.commit()
    return RedirectResponse(url="/admin/events", status_code=303)


@router.get("/admin/events/{event_id}/delete")
async def admin_events_delete(
    event_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    ev = db.query(models.BoEvent).filter(models.BoEvent.id == event_id).first()
    if ev:
        db.delete(ev)
        db.commit()
    return RedirectResponse(url="/admin/events", status_code=303)
