"""
대가들의 한마디 관리 라우터
 - BO에서 명언/대가/사진을 등록·수정
 - 프론트엔드(stock-chat)에서는 /api/master-quotes 로 조회
"""
from typing import Optional

from fastapi import APIRouter, Depends, Form, Query, Request, HTTPException
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_api_key
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

  people = (
    db.query(models.MasterPerson)
    .filter(models.MasterPerson.is_active == "active")
    .order_by(models.MasterPerson.name)
    .all()
  )

  return templates.TemplateResponse(
    "admin_master_quotes.html",
    {
      "request": request,
      "admin_email": user.email,
      "active_page": "master-quotes",
      "quotes": quotes,
      "people": people,
      "total": total,
      "page": page,
      "total_pages": total_pages,
      "q": q or "",
    },
  )


@router.post("/admin/master-quotes/add")
async def add_master_quote(
  person_id: int = Form(...),
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

  person = db.query(models.MasterPerson).filter(models.MasterPerson.id == person_id).first()
  if not person:
    return _js_alert_back("선택한 인물을 찾을 수 없습니다.")

  new_item = models.MasterQuote(
    name=person.name,
    title=title.strip() or person.title or None,
    quote=quote.strip(),
    image_url=image_url.strip() or person.image_url or None,
    order_index=order_index or 0,
    is_active="active",
  )
  db.add(new_item)
  db.commit()

  return RedirectResponse(url="/admin/master-quotes", status_code=303)


@router.post("/admin/master-people/add")
async def add_master_person(
  name: str = Form(...),
  title: str = Form(""),
  image_url: str = Form(""),
  user=Depends(get_current_user),
  db: Session = Depends(get_db),
):
  """대가 인물 등록 (이름/사진)"""
  if not user:
    return RedirectResponse(url="/", status_code=303)

  name = name.strip()
  if not name:
    return _js_alert_back("이름은 필수입니다.")

  existing = db.query(models.MasterPerson).filter(models.MasterPerson.name == name).first()
  if existing:
    return _js_alert_back("이미 등록된 인물입니다.")

  person = models.MasterPerson(
    name=name,
    title=title.strip() or None,
    image_url=image_url.strip() or None,
    is_active="active",
  )
  db.add(person)
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
  email: Optional[str] = Query(None, description="회원 이메일 (좋아요 여부 확인용)"),
  guest_id: Optional[str] = Query(None, description="비회원 식별자 (좋아요 여부 확인용)"),
  _=Depends(verify_api_key),
  db: Session = Depends(get_db),
):
  """
  프론트엔드용 대가들의 한마디 조회 API
  - stock-chat 페이지에서 사용
  - email 또는 guest_id가 있으면 각 항목의 is_liked, like_count 포함
  """
  items = (
    db.query(models.MasterQuote)
    .filter(models.MasterQuote.is_active == "active")
    .order_by(models.MasterQuote.order_index, models.MasterQuote.id)
    .all()
  )

  member_id = None
  if email and email.strip():
    member = db.query(models.Member).filter(models.Member.email == email.strip()).first()
    if member:
      member_id = member.id

  quote_ids = [item.id for item in items]
  like_counts = {}
  liked_ids = set()

  if quote_ids:
    from sqlalchemy import func
    count_rows = (
      db.query(models.MasterQuoteLike.master_quote_id, func.count(models.MasterQuoteLike.id).label("cnt"))
      .filter(models.MasterQuoteLike.master_quote_id.in_(quote_ids))
      .group_by(models.MasterQuoteLike.master_quote_id)
      .all()
    )
    like_counts = {r.master_quote_id: r.cnt for r in count_rows}

    if member_id:
      liked = db.query(models.MasterQuoteLike.master_quote_id).filter(
        models.MasterQuoteLike.master_quote_id.in_(quote_ids),
        models.MasterQuoteLike.member_id == member_id,
      ).all()
      liked_ids = {r.master_quote_id for r in liked}
    elif guest_id and guest_id.strip():
      liked = db.query(models.MasterQuoteLike.master_quote_id).filter(
        models.MasterQuoteLike.master_quote_id.in_(quote_ids),
        models.MasterQuoteLike.guest_id == guest_id.strip(),
      ).all()
      liked_ids = {r.master_quote_id for r in liked}

  return JSONResponse(
    {
      "items": [
        {
          "id": item.id,
          "name": item.name,
          "title": item.title,
          "quote": item.quote,
          "image_url": item.image_url,
          "likes": like_counts.get(item.id, 0),
          "is_liked": item.id in liked_ids,
        }
        for item in items
      ]
    }
  )


class MasterQuoteLikeRequest(BaseModel):
  email: Optional[str] = None
  guest_id: Optional[str] = None


@router.post("/api/master-quotes/{quote_id}/like")
async def api_master_quote_like(
  quote_id: int,
  body: MasterQuoteLikeRequest,
  _=Depends(verify_api_key),
  db: Session = Depends(get_db),
):
  """
  대가 명언 좋아요 토글 (추가/취소)
  - email: 로그인 회원 이메일
  - guest_id: 비회원 식별자 (localStorage 등에서 생성해 전달)
  """
  quote = db.query(models.MasterQuote).filter(
    models.MasterQuote.id == quote_id,
    models.MasterQuote.is_active == "active",
  ).first()
  if not quote:
    raise HTTPException(status_code=404, detail="명언을 찾을 수 없습니다.")

  member_id = None
  guest_id = (body.guest_id or "").strip() or None

  if (body.email or "").strip():
    member = db.query(models.Member).filter(models.Member.email == body.email.strip()).first()
    if member:
      member_id = member.id

  if not member_id and not guest_id:
    raise HTTPException(status_code=400, detail="email 또는 guest_id 중 하나는 필요합니다.")

  existing = db.query(models.MasterQuoteLike).filter(
    models.MasterQuoteLike.master_quote_id == quote_id,
  )
  if member_id:
    existing = existing.filter(models.MasterQuoteLike.member_id == member_id)
  else:
    existing = existing.filter(models.MasterQuoteLike.guest_id == guest_id)
  existing = existing.first()

  if existing:
    db.delete(existing)
    db.commit()
    liked = False
  else:
    new_like = models.MasterQuoteLike(
      master_quote_id=quote_id,
      member_id=member_id,
      guest_id=guest_id,
    )
    db.add(new_like)
    db.commit()
    liked = True

  like_count = db.query(models.MasterQuoteLike).filter(
    models.MasterQuoteLike.master_quote_id == quote_id,
  ).count()

  return {"success": True, "liked": liked, "like_count": like_count}

