"""
대가들의 한마디 관리 라우터
 - BO에서 명언/대가/사진을 등록·수정
 - 프론트엔드(stock-chat)에서는 /api/master-quotes 로 조회
"""
from typing import Optional

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_api_key
from app.config import ADMIN_EMAIL
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


def _js_alert_redirect(message: str, url: str = "/admin/master-quotes") -> HTMLResponse:
  return HTMLResponse(
    f"<script>alert({message!r}); location.href={url!r};</script>"
  )


def _js_alert_back(message: str) -> HTMLResponse:
  return HTMLResponse(
    f"<script>alert({message!r}); history.back();</script>"
  )


@router.get("/admin/master-quotes", response_class=HTMLResponse)
async def admin_master_quotes_page(
  request: Request,
  q: Optional[str] = Query(None),
  page: int = Query(1, ge=1),
  user=Depends(get_current_user),
  db: Session = Depends(get_db),
):
  """대가들의 한마디 관리 페이지 (검색 + 페이지네이션)"""
  if not user:
    return RedirectResponse(url="/")

  per_page = 20
  query = db.query(models.MasterQuote)

  if q and q.strip():
    search = f"%{q.strip()}%"
    query = query.filter(
      models.MasterQuote.name.ilike(search) | models.MasterQuote.quote.ilike(search)
    )

  total = query.count()
  total_pages = max(1, (total + per_page - 1) // per_page)
  page = min(page, total_pages)

  quotes = (
    query.order_by(models.MasterQuote.order_index, models.MasterQuote.id)
    .offset((page - 1) * per_page)
    .limit(per_page)
    .all()
  )

  return templates.TemplateResponse(
    "admin_master_quotes.html",
    {
      "request": request,
      "admin_email": ADMIN_EMAIL,
      "active_page": "master-quotes",
      "quotes": quotes,
      "total": total,
      "page": page,
      "total_pages": total_pages,
      "q": q or "",
    },
  )


@router.post("/admin/master-quotes/add")
async def add_master_quote(
  name: str = Form(...),
  title: str = Form(""),
  quote: str = Form(...),
  image_url: str = Form(""),
  order_index: int = Form(0),
  user=Depends(get_current_user),
  db: Session = Depends(get_db),
):
  """대가 한마디 추가"""
  if not user:
    return RedirectResponse(url="/", status_code=303)

  name = name.strip()
  if not name:
    return _js_alert_back("이름은 필수입니다.")

  new_item = models.MasterQuote(
    name=name,
    title=title.strip() or None,
    quote=quote.strip(),
    image_url=image_url.strip() or None,
    order_index=order_index or 0,
    is_active="active",
  )
  db.add(new_item)
  db.commit()

  return RedirectResponse(url="/admin/master-quotes", status_code=303)


@router.post("/admin/master-quotes/update/{item_id}")
async def update_master_quote(
  item_id: int,
  name: str = Form(...),
  title: str = Form(""),
  quote: str = Form(...),
  image_url: str = Form(""),
  order_index: int = Form(0),
  is_active: str = Form("active"),
  user=Depends(get_current_user),
  db: Session = Depends(get_db),
):
  """대가 한마디 수정"""
  if not user:
    return RedirectResponse(url="/", status_code=303)

  item = db.query(models.MasterQuote).filter(models.MasterQuote.id == item_id).first()
  if not item:
    return _js_alert_back("데이터를 찾을 수 없습니다.")

  item.name = name.strip() or item.name
  item.title = title.strip() or None
  item.quote = quote.strip()
  item.image_url = image_url.strip() or None
  item.order_index = order_index or 0
  item.is_active = is_active if is_active in ("active", "inactive") else "active"
  db.commit()

  return RedirectResponse(url="/admin/master-quotes", status_code=303)


@router.get("/admin/master-quotes/delete/{item_id}")
async def delete_master_quote(
  item_id: int,
  user=Depends(get_current_user),
  db: Session = Depends(get_db),
):
  """대가 한마디 삭제"""
  if not user:
    return RedirectResponse(url="/", status_code=303)

  item = db.query(models.MasterQuote).filter(models.MasterQuote.id == item_id).first()
  if item:
    db.delete(item)
    db.commit()

  return RedirectResponse(url="/admin/master-quotes", status_code=303)


@router.get("/api/master-quotes")
async def api_master_quotes(
  _=Depends(verify_api_key),
  db: Session = Depends(get_db),
):
  """
  프론트엔드용 대가들의 한마디 조회 API
  - stock-chat 페이지에서 사용
  """
  items = (
    db.query(models.MasterQuote)
    .filter(models.MasterQuote.is_active == "active")
    .order_by(models.MasterQuote.order_index, models.MasterQuote.id)
    .all()
  )

  return JSONResponse(
    {
      "items": [
        {
          "id": item.id,
          "name": item.name,
          "title": item.title,
          "quote": item.quote,
          "image_url": item.image_url,
        }
        for item in items
      ]
    }
  )

