"""
시장의 목소리: person_master, market_voices 관리
- BO: pending 목록 조회, 승인/거절
- API: approved 목록 조회 (앱 노출)
"""
from typing import Optional
from datetime import datetime
import pytz
from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_api_key
from app import models


def _js_alert_back(message: str) -> HTMLResponse:
    return HTMLResponse(f"<script>alert({message!r}); history.back();</script>")


def format_datetime_kst(dt: Optional[datetime]) -> str:
    """DB timestamptz(대개 UTC) → 관리자 화면용 한국 시각."""
    if not dt:
        return "-"
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    return dt.astimezone(pytz.timezone("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


# =========================================================
# BO 관리 페이지
# =========================================================

@router.get("/admin/market-voices", response_class=HTMLResponse)
async def admin_market_voices_page(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 관리 페이지 (pending 승인)"""
    if not user:
        return RedirectResponse(url="/")

    q = db.query(models.MarketVoice).join(models.PersonMaster)
    if status_filter in ("pending", "approved"):
        q = q.filter(models.MarketVoice.status == status_filter)
    voices = q.order_by(models.MarketVoice.created_at.desc()).limit(200).all()
    persons = db.query(models.PersonMaster).order_by(models.PersonMaster.order_index, models.PersonMaster.id).all()

    pending_count = db.query(models.MarketVoice).filter(models.MarketVoice.status == "pending").count()

    return templates.TemplateResponse(
        "admin_market_voices.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "market-voices",
            "format_dt_kst": format_datetime_kst,
            "voices": voices,
            "persons": persons,
            "pending_count": pending_count,
            "status_filter": status_filter or "",
        },
    )


# =========================================================
# PersonMaster CRUD
# =========================================================

@router.post("/admin/market-voices/persons/add")
async def add_market_voice_person(
    name: str = Form(...),
    title: str = Form(""),
    search_keyword: str = Form(...),
    image_url: str = Form(""),
    order_index: int = Form(0),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 인물 등록"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    name = name.strip()
    search_keyword = search_keyword.strip()
    if not name or not search_keyword:
        return _js_alert_back("이름과 검색키워드는 필수입니다.")

    existing = db.query(models.PersonMaster).filter(models.PersonMaster.name == name).first()
    if existing:
        return _js_alert_back("이미 등록된 인물입니다.")

    person = models.PersonMaster(
        name=name,
        title=title.strip() or None,
        search_keyword=search_keyword,
        image_url=image_url.strip() or None,
        order_index=order_index,
        is_active="active",
    )
    db.add(person)
    db.commit()
    return RedirectResponse(url="/admin/market-voices", status_code=303)


@router.post("/admin/market-voices/persons/{person_id}/update")
async def update_market_voice_person(
    person_id: int,
    name: str = Form(...),
    title: str = Form(""),
    search_keyword: str = Form(...),
    image_url: str = Form(""),
    order_index: int = Form(0),
    is_active: str = Form("active"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 인물 수정"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    person = db.query(models.PersonMaster).filter(models.PersonMaster.id == person_id).first()
    if not person:
        return JSONResponse({"success": False, "message": "인물을 찾을 수 없습니다."}, status_code=404)

    person.name = name.strip() or person.name
    person.title = title.strip() or None
    person.search_keyword = search_keyword.strip() or person.search_keyword
    person.image_url = image_url.strip() or None
    person.order_index = order_index
    person.is_active = is_active if is_active in ("active", "inactive") else "active"
    db.commit()
    return JSONResponse({"success": True, "message": "수정되었습니다."})


@router.post("/admin/market-voices/persons/{person_id}/delete")
async def delete_market_voice_person(
    person_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 인물 삭제 (cascade로 발언도 삭제)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    person = db.query(models.PersonMaster).filter(models.PersonMaster.id == person_id).first()
    if not person:
        return JSONResponse({"success": False, "message": "인물을 찾을 수 없습니다."}, status_code=404)

    db.delete(person)
    db.commit()
    return JSONResponse({"success": True, "message": "삭제되었습니다."})


@router.post("/api/market-voices/{voice_id}/approve")
async def approve_market_voice(
    voice_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 승인 (pending → approved)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    voice = db.query(models.MarketVoice).filter(models.MarketVoice.id == voice_id).first()
    if not voice:
        return JSONResponse({"success": False, "message": "항목을 찾을 수 없습니다."}, status_code=404)
    voice.status = "approved"
    voice.approved_at = datetime.utcnow()
    db.commit()
    return JSONResponse({"success": True, "message": "승인되었습니다."})


@router.post("/api/market-voices/{voice_id}/reject")
async def reject_market_voice(
    voice_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 거절 (삭제)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    voice = db.query(models.MarketVoice).filter(models.MarketVoice.id == voice_id).first()
    if not voice:
        return JSONResponse({"success": False, "message": "항목을 찾을 수 없습니다."}, status_code=404)
    db.delete(voice)
    db.commit()
    return JSONResponse({"success": True, "message": "삭제되었습니다."})


@router.post("/api/market-voices/collect")
async def manual_collect_market_voices(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """시장의 목소리 수동 수집 (뉴스 검색 + Gemini 요약 → pending 저장)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    try:
        from app.services.scheduler_service import cleanup_old_market_voices
        from app.services.market_voice_service import fetch_and_summarize_news

        cleanup_old_market_voices(db, keep_days=2)
        result = await fetch_and_summarize_news(db)
        msg = f"수집 완료: {result.get('fetched', 0)}건 조회, {result.get('saved', 0)}건 신규 저장 (pending)"
        if result.get("saved", 0) == 0 and result.get("fetched", 0) > 0:
            msg += f"\n스킵: 24h초과={result.get('skip_24h',0)}, Gemini빈응답={result.get('skip_gemini_empty',0)}, 기존존재={result.get('skip_existing',0)}"
        return JSONResponse({
            "success": True,
            "fetched": result.get("fetched", 0),
            "saved": result.get("saved", 0),
            "message": msg,
        })
    except Exception as e:
        import traceback
        print(f"❌ 시장의 목소리 수집 오류: {e}\n{traceback.format_exc()}")
        return JSONResponse({
            "success": False,
            "message": str(e),
        }, status_code=500)


# =========================================================
# 앱용 API (approved만 노출)
# =========================================================

@router.get("/api/market-voices")
async def get_market_voices_for_app(
    limit: int = Query(20, ge=1, le=50),
    api_key: Optional[str] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_api_key),
):
    """시장의 목소리 목록 (approved만, 앱 노출용)"""
    rows = (
        db.query(models.MarketVoice)
        .join(models.PersonMaster)
        .filter(models.MarketVoice.status == "approved")
        .order_by(models.MarketVoice.approved_at.desc().nullslast(), models.MarketVoice.created_at.desc())
        .limit(limit)
        .all()
    )
    data = [
        {
            "id": r.id,
            "name": r.person.name,
            "title": r.person.title or "",
            "image": r.person.image_url or "",
            "statement": r.statement,
            "source_url": r.source_url or "",
            "source_title": r.source_title or "",
            "time": r.news_pub_date or (r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""),
        }
        for r in rows
    ]
    return JSONResponse({"success": True, "data": data})
