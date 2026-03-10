"""
팝업관리 라우터 (Admin)
"""
import os
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/popup", response_class=HTMLResponse)
async def admin_popup_list(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        return RedirectResponse(url="/")
    popups = db.query(models.Popup).order_by(models.Popup.order_index, models.Popup.id.desc()).all()
    return templates.TemplateResponse("admin_popup.html", {
        "request": request,
        "popups": popups,
        "admin_email": user.email,
        "active_page": "popup",
        "now": datetime.utcnow(),
    })


@router.post("/admin/popup/add")
async def admin_popup_add(
    title: str = Form(...),
    content_type: str = Form("html"),
    html_content: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    start_date: str = Form(...),
    end_date: str = Form(...),
    order_index: int = Form(0),
    image_file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date)

    final_image_url = image_url
    if content_type == "image" and image_file and image_file.filename:
        from app.config import UPLOADS_DIR
        upload_dir = UPLOADS_DIR / "popups"
        upload_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_name = "".join(c for c in image_file.filename if c.isalnum() or c in "._- ")
        filename = f"{ts}_{safe_name}"
        filepath = upload_dir / filename
        data = await image_file.read()
        with open(filepath, "wb") as f:
            f.write(data)
        final_image_url = f"/uploads/popups/{filename}"

    popup = models.Popup(
        title=title.strip(),
        content_type=content_type,
        html_content=html_content if content_type == "html" else None,
        image_url=final_image_url if content_type == "image" else None,
        link_url=link_url.strip() if link_url else None,
        start_date=start_dt,
        end_date=end_dt,
        order_index=order_index,
        is_active="active",
    )
    db.add(popup)
    db.commit()
    return RedirectResponse(url="/admin/popup", status_code=303)


@router.get("/admin/popup/edit/{popup_id}", response_class=HTMLResponse)
async def admin_popup_edit_page(
    popup_id: int, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    if not user:
        return RedirectResponse(url="/")
    popup = db.query(models.Popup).filter(models.Popup.id == popup_id).first()
    if not popup:
        raise HTTPException(status_code=404, detail="팝업을 찾을 수 없습니다.")
    return templates.TemplateResponse("admin_popup_edit.html", {
        "request": request,
        "popup": popup,
        "admin_email": user.email,
        "active_page": "popup",
    })


@router.post("/admin/popup/edit/{popup_id}")
async def admin_popup_edit(
    popup_id: int,
    title: str = Form(...),
    content_type: str = Form("html"),
    html_content: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    start_date: str = Form(...),
    end_date: str = Form(...),
    order_index: int = Form(0),
    is_active: str = Form("active"),
    image_file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    popup = db.query(models.Popup).filter(models.Popup.id == popup_id).first()
    if not popup:
        raise HTTPException(status_code=404, detail="팝업을 찾을 수 없습니다.")

    popup.title = title.strip()
    popup.content_type = content_type
    popup.link_url = link_url.strip() if link_url else None
    popup.start_date = datetime.fromisoformat(start_date)
    popup.end_date = datetime.fromisoformat(end_date)
    popup.order_index = order_index
    popup.is_active = is_active

    if content_type == "html":
        popup.html_content = html_content
        popup.image_url = None
    else:
        popup.html_content = None
        if image_file and image_file.filename:
            from app.config import UPLOADS_DIR
            upload_dir = UPLOADS_DIR / "popups"
            upload_dir.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_name = "".join(c for c in image_file.filename if c.isalnum() or c in "._- ")
            filename = f"{ts}_{safe_name}"
            filepath = upload_dir / filename
            data = await image_file.read()
            with open(filepath, "wb") as f:
                f.write(data)
            popup.image_url = f"/uploads/popups/{filename}"
        elif image_url:
            popup.image_url = image_url

    db.commit()
    return RedirectResponse(url="/admin/popup", status_code=303)


@router.get("/admin/popup/delete/{popup_id}")
async def admin_popup_delete(popup_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    popup = db.query(models.Popup).filter(models.Popup.id == popup_id).first()
    if popup:
        db.delete(popup)
        db.commit()
    return RedirectResponse(url="/admin/popup", status_code=303)


@router.get("/admin/popup/toggle/{popup_id}")
async def admin_popup_toggle(popup_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    popup = db.query(models.Popup).filter(models.Popup.id == popup_id).first()
    if popup:
        popup.is_active = "inactive" if popup.is_active == "active" else "active"
        db.commit()
    return RedirectResponse(url="/admin/popup", status_code=303)
