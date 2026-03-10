"""
프로필 설정 관리 라우터 (캐릭터 및 주식 단어 관리)
"""
from fastapi import APIRouter, Form, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/profile", response_class=HTMLResponse)
async def admin_profile_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """프로필 설정 관리 페이지 (캐릭터 및 주식 단어)"""
    if not user:
        return RedirectResponse(url="/")
    
    characters = db.query(models.Character).order_by(models.Character.order_index).all()
    stock_words = db.query(models.StockWord).order_by(models.StockWord.order_index).all()
    
    return templates.TemplateResponse("admin_profile.html", {
        "request": request,
        "admin_email": user.email,
        "characters": characters,
        "stock_words": stock_words,
        "active_page": "profile"
    })


# ==================== 캐릭터 관리 ====================

@router.post("/admin/profile/character/add")
async def add_character(
    name: str = Form(...),
    image_url: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """캐릭터 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    # 최대 15개 제한
    count = db.query(models.Character).count()
    if count >= 15:
        return HTMLResponse("<script>alert('최대 15개의 캐릭터만 등록할 수 있습니다.'); history.back();</script>")
    
    # 마지막 order_index 가져오기
    last_char = db.query(models.Character).order_by(models.Character.order_index.desc()).first()
    next_order = (last_char.order_index + 1) if last_char else 0
    
    new_character = models.Character(
        name=name,
        image_url=image_url,
        order_index=next_order,
        is_active="active"
    )
    db.add(new_character)
    db.commit()
    
    return RedirectResponse(url="/admin/profile", status_code=303)


@router.post("/admin/profile/character/update/{character_id}")
async def update_character(
    character_id: int,
    name: str = Form(...),
    image_url: str = Form(...),
    is_active: str = Form("active"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """캐릭터 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        return HTMLResponse("<script>alert('캐릭터를 찾을 수 없습니다.'); history.back();</script>")
    
    character.name = name
    character.image_url = image_url
    character.is_active = is_active
    db.commit()
    
    return RedirectResponse(url="/admin/profile", status_code=303)


@router.get("/admin/profile/character/delete/{character_id}")
async def delete_character(
    character_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """캐릭터 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if character:
        db.delete(character)
        db.commit()
    
    return RedirectResponse(url="/admin/profile", status_code=303)


# ==================== 주식 단어 관리 ====================

@router.post("/admin/profile/stock-word/add")
async def add_stock_word(
    word: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """주식 단어 추가"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    # 최대 120개 제한
    count = db.query(models.StockWord).count()
    if count >= 120:
        return HTMLResponse("<script>alert('최대 120개의 단어만 등록할 수 있습니다.'); history.back();</script>")
    
    # 중복 확인
    existing = db.query(models.StockWord).filter(models.StockWord.word == word).first()
    if existing:
        return HTMLResponse("<script>alert('이미 존재하는 단어입니다.'); history.back();</script>")
    
    # 마지막 order_index 가져오기
    last_word = db.query(models.StockWord).order_by(models.StockWord.order_index.desc()).first()
    next_order = (last_word.order_index + 1) if last_word else 0
    
    new_word = models.StockWord(
        word=word,
        order_index=next_order,
        is_active="active"
    )
    db.add(new_word)
    db.commit()
    
    return RedirectResponse(url="/admin/profile", status_code=303)


@router.post("/admin/profile/stock-word/update/{word_id}")
async def update_stock_word(
    word_id: int,
    word: str = Form(...),
    is_active: str = Form("active"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """주식 단어 수정"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    stock_word = db.query(models.StockWord).filter(models.StockWord.id == word_id).first()
    if not stock_word:
        return HTMLResponse("<script>alert('단어를 찾을 수 없습니다.'); history.back();</script>")
    
    # 중복 확인 (자기 자신 제외)
    existing = db.query(models.StockWord).filter(
        models.StockWord.word == word,
        models.StockWord.id != word_id
    ).first()
    if existing:
        return HTMLResponse("<script>alert('이미 존재하는 단어입니다.'); history.back();</script>")
    
    stock_word.word = word
    stock_word.is_active = is_active
    db.commit()
    
    return RedirectResponse(url="/admin/profile", status_code=303)


@router.get("/admin/profile/stock-word/delete/{word_id}")
async def delete_stock_word(
    word_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """주식 단어 삭제"""
    if not user:
        return RedirectResponse(url="/", status_code=303)
    
    stock_word = db.query(models.StockWord).filter(models.StockWord.id == word_id).first()
    if stock_word:
        db.delete(stock_word)
        db.commit()
    
    return RedirectResponse(url="/admin/profile", status_code=303)

