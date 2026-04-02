"""
등급 정책(grade_policies) 관리
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


def _parse_json_obj(raw: Optional[str]) -> Optional[dict]:
    if not raw or not str(raw).strip():
        return None
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else None
    except json.JSONDecodeError:
        return None


@router.get("/admin/grade-policies", response_class=HTMLResponse)
async def admin_grade_policies_list(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")

    policies = db.query(models.GradePolicy).order_by(models.GradePolicy.id.desc()).all()
    return templates.TemplateResponse(
        "admin_grade_policies.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "grade-policies",
            "policies": policies,
        },
    )


@router.get("/admin/grade-policies/new", response_class=HTMLResponse)
async def admin_grade_policies_new(
    request: Request,
    user=Depends(get_current_user),
):
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "admin_grade_policies_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "grade-policies",
            "policy": None,
            "conditions_json": '{\n  "days": 30\n}',
        },
    )


@router.get("/admin/grade-policies/{policy_id}/edit", response_class=HTMLResponse)
async def admin_grade_policies_edit(
    policy_id: int,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    pol = db.query(models.GradePolicy).filter(models.GradePolicy.id == policy_id).first()
    if not pol:
        return RedirectResponse(url="/admin/grade-policies", status_code=303)
    cj = ""
    if pol.conditions_json:
        try:
            cj = json.dumps(pol.conditions_json, ensure_ascii=False, indent=2)
        except TypeError:
            cj = str(pol.conditions_json)
    return templates.TemplateResponse(
        "admin_grade_policies_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "grade-policies",
            "policy": pol,
            "conditions_json": cj or "{}",
        },
    )


@router.post("/admin/grade-policies/add")
async def admin_grade_policies_add(
    name: str = Form(...),
    target_grade: str = Form(...),
    condition_type: str = Form(...),
    is_active: Optional[str] = Form(None),
    is_auto: Optional[str] = Form(None),
    benefit_days: Optional[str] = Form(None),
    upgrade_once: Optional[str] = Form(None),
    description: str = Form(""),
    conditions_json: str = Form("{}"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    bd = None
    if benefit_days and str(benefit_days).strip().isdigit():
        bd = int(benefit_days)
    pol = models.GradePolicy(
        name=name.strip(),
        target_grade=target_grade.strip(),
        is_active=bool(is_active),
        is_auto=bool(is_auto),
        condition_type=condition_type.strip(),
        conditions_json=_parse_json_obj(conditions_json) or {},
        benefit_days=bd,
        upgrade_once=bool(upgrade_once),
        description=description.strip() or None,
    )
    db.add(pol)
    db.commit()
    return RedirectResponse(url="/admin/grade-policies", status_code=303)


@router.post("/admin/grade-policies/{policy_id}/edit")
async def admin_grade_policies_update(
    policy_id: int,
    name: str = Form(...),
    target_grade: str = Form(...),
    condition_type: str = Form(...),
    is_active: Optional[str] = Form(None),
    is_auto: Optional[str] = Form(None),
    benefit_days: Optional[str] = Form(None),
    upgrade_once: Optional[str] = Form(None),
    description: str = Form(""),
    conditions_json: str = Form("{}"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    pol = db.query(models.GradePolicy).filter(models.GradePolicy.id == policy_id).first()
    if not pol:
        return RedirectResponse(url="/admin/grade-policies", status_code=303)
    bd = None
    if benefit_days and str(benefit_days).strip().isdigit():
        bd = int(benefit_days)
    pol.name = name.strip()
    pol.target_grade = target_grade.strip()
    pol.is_active = bool(is_active)
    pol.is_auto = bool(is_auto)
    pol.condition_type = condition_type.strip()
    parsed = _parse_json_obj(conditions_json)
    pol.conditions_json = parsed if parsed is not None else {}
    pol.benefit_days = bd
    pol.upgrade_once = bool(upgrade_once)
    pol.description = description.strip() or None
    db.commit()
    return RedirectResponse(url="/admin/grade-policies", status_code=303)


@router.get("/admin/grade-policies/{policy_id}/delete")
async def admin_grade_policies_delete(
    policy_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    pol = db.query(models.GradePolicy).filter(models.GradePolicy.id == policy_id).first()
    if pol:
        db.delete(pol)
        db.commit()
    return RedirectResponse(url="/admin/grade-policies", status_code=303)
