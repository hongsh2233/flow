"""
REST API 라우터 - 프론트엔드용

이 모듈은 외부 애플리케이션에서 데이터를 조회할 수 있도록 RESTful API 엔드포인트를 제공합니다.
주식 데이터(KRX, FSC)는 API Key를 통해 인증하고, 
게시판 및 일정 관리 등은 JWT 토큰 또는 API Key를 통해 인증합니다.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import distinct, cast, Integer, Float, func
from typing import Optional
from datetime import datetime, date
import json
import asyncio
import time
import httpx

from app.database import get_db
from app import models
from app.routers.board import parse_attached_files, clean_content
from app.dependencies import get_current_user_from_token, get_current_user_from_token_optional, verify_api_key, API_SECRET_KEY
from app.services.api_service import krx_api_service  # 시장현황 데이터 처리를 위한 서비스 임포트
from pydantic import BaseModel

router = APIRouter()

# 메인 페이지 설정 응답 모델
class MainPageItemResponse(BaseModel):
    id: int
    name: str
    component_key: str
    order_index: int
    is_visible: str
    start_date: Optional[str] = None  # 노출 시작일시 (YYYY-MM-DD HH:MM 형식, None이면 항상 노출)
    end_date: Optional[str] = None  # 노출 종료일시 (YYYY-MM-DD HH:MM 형식, None이면 항상 노출)
    repeat_type: Optional[str] = "none"  # 반복 타입 ('none', 'daily', 'weekly')
    repeat_days: Optional[str] = None  # 주간 반복 요일 (예: "1,3,5")
    repeat_start_time: Optional[str] = None  # 반복 시작 시간 (HH:MM)
    repeat_end_time: Optional[str] = None  # 반복 종료 시간 (HH:MM)
    repeat_next_day: Optional[str] = "false"  # 익일까지 반복 여부 ('true', 'false')

    class Config:
        from_attributes = True

class MainPageConfigResponse(BaseModel):
    success: bool
    message: str
    items: list[MainPageItemResponse] = []

# ---------------------------------------------------------
# API 인증 설정
# ---------------------------------------------------------
# verify_api_key는 app.dependencies에서 import하여 사용
# API_SECRET_KEY도 app.dependencies에서 import하여 사용
# 이렇게 하면 환경 변수(NEXT_PUBLIC_X_API_KEY)를 일관되게 사용할 수 있습니다.


def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    """datetime을 ISO 형식 문자열로 변환"""
    if dt is None:
        return None
    return dt.isoformat()


def serialize_date(d: Optional[date]) -> Optional[str]:
    """date를 ISO 형식 문자열로 변환"""
    if d is None:
        return None
    return d.isoformat()


# =========================================================
# 한국거래소(KRX) 데이터 API (API Key 인증)
# =========================================================

@router.get("/api/krx-data")
async def get_krx_data(
    data_type: Optional[str] = Query(None, description="데이터 타입 (kospi, kosdaq, market)"),
    bas_dd: Optional[str] = Query(None, description="기준일자 (YYYYMMDD)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)  # API Key 인증 사용
):
    """
    한국거래소 데이터(finance-data) 조회
    프론트엔드 시장 현황 탭에서 사용됩니다.
    """
    query = db.query(models.KrxData)
    
    # 데이터 타입 필터링
    if data_type:
        query = query.filter(models.KrxData.data_type == data_type)
    
    # 날짜 필터링
    if bas_dd:
        query = query.filter(models.KrxData.bas_dd == bas_dd)
    else:
        # 최신 날짜순 정렬
        query = query.order_by(models.KrxData.bas_dd.desc())
    
    krx_data_list = query.all()
    
    if not krx_data_list:
        # 데이터가 없을 경우 404
        raise HTTPException(status_code=404, detail="데이터를 찾을 수 없습니다.")
    
    # 데이터 변환
    result = []
    for krx_data in krx_data_list:
        try:
            data_json = json.loads(krx_data.data) if isinstance(krx_data.data, str) else krx_data.data
        except:
            data_json = {}
        
        result.append({
            "id": krx_data.id,
            "data_type": krx_data.data_type,
            "bas_dd": krx_data.bas_dd,
            "data": data_json,
            "created_at": serialize_datetime(krx_data.created_at),
            "updated_at": serialize_datetime(krx_data.updated_at)
        })
    
    return {
        "success": True,
        "data": result,
        "count": len(result)
    }


@router.get("/api/krx-data/dates")
async def get_krx_data_dates(
    data_type: Optional[str] = Query(None, description="데이터 타입 (kospi, kosdaq, market)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    한국거래소 데이터가 있는 날짜 목록 조회
    """
    query = db.query(distinct(models.KrxData.bas_dd))
    
    if data_type:
        query = query.filter(models.KrxData.data_type == data_type)
    
    dates = query.order_by(models.KrxData.bas_dd.desc()).all()
    date_list = [date[0] for date in dates]
    
    return {
        "success": True,
        "data": date_list,
        "count": len(date_list)
    }


# =========================================================
# 금융위원회(FSC) 주식시세정보 API (API Key 인증)
# =========================================================

@router.get("/api/fsc-stock-price")
async def get_fsc_stock_price(
    bas_dt: Optional[str] = Query(None, description="기준일자 (YYYYMMDD). None이면 최신 데이터"),
    limit: int = Query(200, ge=1, le=1000, description="반환할 최대 항목 수"),
    min_flt_rt: Optional[float] = Query(None, description="최소 등락률 (%)"),
    max_flt_rt: Optional[float] = Query(None, description="최대 등락률 (%)"),
    mrkt_ctg: Optional[str] = Query(None, description="시장구분 (KOSPI, KOSDAQ)"),
    order_by: Optional[str] = Query("mrkt_tot_amt", description="정렬 기준 (mrkt_tot_amt, flt_rt)"),
    order_direction: Optional[str] = Query("desc", description="정렬 방향 (asc, desc)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    금융위원회 주식시세정보 조회 (시가총액 상위 종목)
    프론트엔드 관심종목/등락률/거래대금 탭에서 사용됩니다.
    """
    query = db.query(models.FscStockPrice)
    
    if bas_dt:
        query = query.filter(models.FscStockPrice.bas_dt == bas_dt)
        print(f"📅 FSC 주식시세 조회 (지정된 날짜): {bas_dt}")
    else:
        # 최신 날짜 조회 (DB에 저장된 가장 최근 날짜)
        latest_date_result = db.query(
            func.max(models.FscStockPrice.bas_dt)
        ).scalar()
        
        if latest_date_result:
            latest_date_str = latest_date_result
            query = query.filter(models.FscStockPrice.bas_dt == latest_date_str)
            print(f"✅ FSC 주식시세 최신 날짜 조회: {latest_date_str}")
        else:
            # 데이터 없음 시 404 대신 200 + 빈 배열 반환 (프론트 페이지 정상 로드)
            print(f"⚠️ FSC 주식시세 데이터가 DB에 없습니다.")
            return {
                "success": True,
                "data": [],
                "bas_dt": None,
                "count": 0
            }
    
    # 시장구분 필터링 (DB 레벨에서 먼저 필터링)
    if mrkt_ctg:
        query = query.filter(models.FscStockPrice.mrkt_ctg == mrkt_ctg)
    
    # 모든 데이터 가져오기 (등락률 필터링은 Python에서 처리)
    all_stocks = query.all()
    
    # 등락률 필터링 (Python에서 처리 - 문자열 파싱 필요)
    filtered_stocks = []
    for stock in all_stocks:
        if stock.flt_rt:
            # 등락률 문자열 파싱 (% 제거, 공백 제거, 부호 유지)
            flt_rt_str = str(stock.flt_rt).replace('%', '').replace(' ', '').strip()
            # 부호 확인
            is_negative = flt_rt_str.startswith('-')
            # 부호 제거 후 숫자 변환
            flt_rt_clean = flt_rt_str.replace('+', '').replace('-', '').strip()
            try:
                flt_rt_value = float(flt_rt_clean) if flt_rt_clean else 0.0
                if is_negative:
                    flt_rt_value = -flt_rt_value
            except (ValueError, TypeError):
                flt_rt_value = 0.0
        else:
            flt_rt_value = 0.0
        
        # 등락률 필터링 체크
        if min_flt_rt is not None and flt_rt_value < min_flt_rt:
            continue
        if max_flt_rt is not None and flt_rt_value > max_flt_rt:
            continue
        
        filtered_stocks.append(stock)
    
    # 정렬 옵션
    reverse_order = order_direction != "asc"
    
    if order_by == "flt_rt":
        # 등락률 정렬
        stock_prices = sorted(
            filtered_stocks,
            key=lambda x: float(str(x.flt_rt or '0').replace('%', '').replace('+', '').replace('-', '').replace(' ', '').strip() or 0) if x.flt_rt else 0,
            reverse=reverse_order
        )[:limit]
    else:
        # 시가총액 정렬 (기본값)
        # 시가총액이 문자열이므로 숫자로 변환하여 정렬
        stock_prices = sorted(
            filtered_stocks,
            key=lambda x: float(str(x.mrkt_tot_amt or '0').replace(',', '').replace(' ', '') or 0),
            reverse=reverse_order
        )[:limit]
    
    # 데이터가 없어도 빈 배열 반환 (404 에러 대신)
    if not stock_prices:
        return {
            "success": True,
            "data": [],
            "bas_dt": None,
            "count": 0
        }
    
    result = []
    for stock in stock_prices:
        result.append({
            "id": stock.id,
            "bas_dt": stock.bas_dt,
            "srtn_cd": stock.srtn_cd,
            "isin_cd": stock.isin_cd,
            "itms_nm": stock.itms_nm,
            "mrkt_ctg": stock.mrkt_ctg,
            "clpr": stock.clpr,
            "vs": stock.vs,
            "flt_rt": stock.flt_rt,
            "mkp": stock.mkp,
            "hipr": stock.hipr,
            "lopr": stock.lopr,
            "trqu": stock.trqu,
            "tr_prc": stock.tr_prc,
            "lstg_st_cnt": stock.lstg_st_cnt,
            "mrkt_tot_amt": stock.mrkt_tot_amt,
            "created_at": serialize_datetime(stock.created_at),
            "updated_at": serialize_datetime(stock.updated_at)
        })
    
    return {
        "success": True,
        "data": result,
        "bas_dt": stock_prices[0].bas_dt if stock_prices else None,
        "count": len(result)
    }


@router.get("/api/fsc-stock-price/dates")
async def get_fsc_stock_price_dates(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    금융위원회 주식시세정보가 있는 날짜 목록 조회
    """
    dates = db.query(distinct(models.FscStockPrice.bas_dt)).order_by(
        models.FscStockPrice.bas_dt.desc()
    ).all()
    date_list = [date[0] for date in dates]
    
    return {
        "success": True,
        "data": date_list,
        "count": len(date_list)
    }


# =========================================================
# 게시판 API (기존 Token 인증 + API Key 인증 허용)
# =========================================================

async def get_current_user_or_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY"),
    user = Depends(get_current_user_from_token_optional)
):
    """
    게시판 등은 사용자 토큰이 있으면 사용자 인증, 
    없으면 API Key로 인증 (읽기 전용 등)
    
    API Key를 먼저 확인하고, 없으면 토큰을 확인합니다.
    FastAPI는 의존성을 위에서 아래로 평가하므로, x_api_key가 먼저 처리됩니다.
    """
    # API Key 검증 (우선순위) - 공백 제거 후 비교
    if x_api_key:
        # 앞뒤 공백 제거
        x_api_key_cleaned = x_api_key.strip()
        if x_api_key_cleaned == API_SECRET_KEY:
            return True  # API Key로 인증됨
        else:
            # API 키 불일치
            raise HTTPException(
                status_code=401, 
                detail="Not authenticated"
            )
    
    # 사용자 토큰 확인 (선택적)
    if user:
        return user
    
    # 둘 다 없으면 에러
    raise HTTPException(status_code=401, detail="Not authenticated")

@router.get("/api/boards")
async def get_boards(
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """게시판 목록 조회"""
    boards = db.query(models.Board).order_by(models.Board.created_at).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": board.id,
                "name": board.name,
                "type": board.type,
                "auth": board.auth,
                "created_at": serialize_datetime(board.created_at),
                "updated_at": serialize_datetime(board.updated_at),
                "post_count": len(board.posts) if board.posts else 0
            }
            for board in boards
        ],
        "count": len(boards)
    }


@router.get("/api/boards/{board_id}")
async def get_board(
    board_id: str,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """게시판 상세 조회"""
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    return {
        "success": True,
        "data": {
            "id": board.id,
            "name": board.name,
            "type": board.type,
            "auth": board.auth,
            "created_at": serialize_datetime(board.created_at),
            "updated_at": serialize_datetime(board.updated_at),
            "post_count": len(board.posts) if board.posts else 0
        }
    }


@router.get("/api/boards/{board_id}/posts")
async def get_board_posts(
    board_id: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """게시판의 게시글 목록 조회"""
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    total_count = db.query(models.Post).filter(models.Post.board_id == board_id).count()
    offset = (page - 1) * limit
    posts = db.query(models.Post).filter(
        models.Post.board_id == board_id
    ).order_by(models.Post.created_at.desc()).offset(offset).limit(limit).all()
    
    posts_data = []
    for post in posts:
        attachments = parse_attached_files(post.content or "")
        cleaned_content = clean_content(post.content or "")
        
        # 비밀글 처리: 작성자나 관리자만 내용 확인 가능
        is_secret = post.is_secret == "true" if post.is_secret else False
        display_title = post.title
        display_content = cleaned_content
        
        # 비밀글인 경우 제목과 내용 마스킹 (API Key로 호출하는 경우는 관리자로 간주하여 전체 표시)
        # 실제로는 프론트엔드에서 접근 제어를 수행하므로 여기서는 is_secret 정보만 전달
        
        posts_data.append({
            "id": post.id,
            "board_id": post.board_id,
            "title": display_title,
            "content": display_content,
            "author": post.author,
            "views": post.views or 0,
            "is_secret": post.is_secret or "false",
            "created_at": serialize_datetime(post.created_at),
            "updated_at": serialize_datetime(post.updated_at),
            "attachments": attachments
        })
    
    return {
        "success": True,
        "data": posts_data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0
        }
    }


@router.get("/api/posts/{post_id}")
async def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """게시글 상세 조회"""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    post.views = (post.views or 0) + 1
    db.commit()
    
    attachments = parse_attached_files(post.content or "")
    cleaned_content = clean_content(post.content or "")
    board = post.board if post.board else None
    
    # 디버깅: 첨부파일 정보 확인
    print(f"=== 게시글 상세 API (post_id: {post_id}) ===")
    print(f"첨부파일 개수: {len(attachments)}")
    if attachments:
        print(f"첨부파일 목록:")
        for idx, att in enumerate(attachments):
            print(f"  [{idx}] filename={att.get('filename')}, path={att.get('path')}, type={att.get('type')}")
    else:
        print("첨부파일이 없습니다.")
        print(f"원본 content 길이: {len(post.content or '')}")
        print(f"원본 content 샘플 (마지막 200자): {(post.content or '')[-200:]}")
    
    # 비밀글 접근 제어: 작성자나 관리자만 조회 가능
    is_secret = post.is_secret == "true" if post.is_secret else False
    # API Key로 호출하는 경우는 관리자로 간주하여 전체 표시
    # 실제 접근 제어는 프론트엔드에서 수행
    
    response_data = {
        "id": post.id,
        "board_id": post.board_id,
        "board": {
            "id": board.id,
            "name": board.name,
            "type": board.type
        } if board else None,
        "title": post.title,
        "content": cleaned_content,
        "author": post.author,
        "views": post.views or 0,
        "is_secret": post.is_secret or "false",
        "created_at": serialize_datetime(post.created_at),
        "updated_at": serialize_datetime(post.updated_at),
        "attachments": attachments
    }
    
    print(f"응답 데이터 attachments 필드: {response_data.get('attachments')}")
    
    return {
        "success": True,
        "data": response_data
    }


# =========================================================
# 일정 관리 API (Token 또는 API Key 인증)
# =========================================================

@router.get("/api/schedules")
async def get_schedules(
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    type: Optional[str] = Query(None, description="일정 타입 (manual, api)"),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """일정 목록 조회"""
    query = db.query(models.Schedule)
    
    if start_date:
        try:
            start = date.fromisoformat(start_date)
            query = query.filter(models.Schedule.date >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="잘못된 시작 날짜 형식입니다. (YYYY-MM-DD)")
    
    if end_date:
        try:
            end = date.fromisoformat(end_date)
            query = query.filter(models.Schedule.date <= end)
        except ValueError:
            raise HTTPException(status_code=400, detail="잘못된 종료 날짜 형식입니다. (YYYY-MM-DD)")
    
    if type:
        query = query.filter(models.Schedule.type == type)
    
    schedules = query.order_by(models.Schedule.date).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": schedule.id,
                "date": serialize_date(schedule.date),
                "subject": schedule.subject,
                "content": schedule.content or "",
                "type": schedule.type,
                "created_at": serialize_datetime(schedule.created_at),
                "updated_at": serialize_datetime(schedule.updated_at)
            }
            for schedule in schedules
        ],
        "count": len(schedules)
    }


@router.get("/api/schedules/{schedule_id}")
async def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """일정 상세 조회"""
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    
    return {
        "success": True,
        "data": {
            "id": schedule.id,
            "date": serialize_date(schedule.date),
            "subject": schedule.subject,
            "content": schedule.content or "",
            "type": schedule.type,
            "created_at": serialize_datetime(schedule.created_at),
            "updated_at": serialize_datetime(schedule.updated_at)
        }
    }


# =========================================================
# 수집 데이터 API (Token 또는 API Key 인증)
# =========================================================

@router.get("/api/collected-data")
async def get_collected_data(
    type: Optional[str] = Query(None, description="데이터 타입 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    limit: int = Query(100, ge=1, le=1000, description="반환할 최대 항목 수"),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """수집 데이터 조회"""
    query = db.query(models.CollectedData)
    
    if type:
        query = query.filter(models.CollectedData.type == type)
    
    if status:
        query = query.filter(models.CollectedData.status == status)
    
    collected_data = query.order_by(
        models.CollectedData.created_at.desc()
    ).limit(limit).all()
    
    result = []
    for data in collected_data:
        result.append({
            "id": data.id,
            "type": data.type,
            "status": data.status,
            "message": data.message,
            "created_at": serialize_datetime(data.created_at)
        })
    
    return {
        "success": True,
        "data": result,
        "count": len(result)
    }


@router.get("/api/collected-data/{data_id}")
async def get_collected_data_by_id(
    data_id: int,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """수집 데이터 상세 조회"""
    data = db.query(models.CollectedData).filter(models.CollectedData.id == data_id).first()
    
    if not data:
        raise HTTPException(status_code=404, detail="데이터를 찾을 수 없습니다.")
    
    return {
        "success": True,
        "data": {
            "id": data.id,
            "type": data.type,
            "status": data.status,
            "message": data.message,
            "created_at": serialize_datetime(data.created_at)
        }
    }


@router.get("/api/main-page-config", response_model=MainPageConfigResponse)
async def get_main_page_config(
    db: Session = Depends(get_db)
):
    """
    메인 페이지 설정 조회 API
    
    - DB에 저장된 메인 페이지 항목 설정을 그대로 내려줍니다.
    - **시간/요일/기간에 따른 노출 여부 판단은 프론트엔드(브라우저 시간 기준)에서 수행**합니다.
      이렇게 하면 서버 시간대(UTC 등) 차이로 인한 표시 오류를 방지할 수 있습니다.
    """
    items = (
        db.query(models.MainPageItem)
        .order_by(models.MainPageItem.order_index)
        .all()
    )

    item_list = [
        MainPageItemResponse(
            id=item.id,
            name=item.name,
            component_key=item.component_key,
            order_index=item.order_index,
            is_visible=item.is_visible,
            start_date=item.start_date,
            end_date=item.end_date,
            repeat_type=getattr(item, "repeat_type", "none"),
            repeat_days=getattr(item, "repeat_days", None),
            repeat_start_time=getattr(item, "repeat_start_time", None),
            repeat_end_time=getattr(item, "repeat_end_time", None),
            repeat_next_day=getattr(item, "repeat_next_day", "false"),
        )
        for item in items
    ]

    return MainPageConfigResponse(
        success=True,
        message="메인 페이지 설정을 조회했습니다.",
        items=item_list,
    )


# =========================================================
# 하단/헤더 메뉴 API (웹 앱용)
# =========================================================

@router.get("/api/nav-menu")
async def get_nav_menu(db: Session = Depends(get_db)):
    """
    웹 앱 하단·헤더 메뉴 목록 조회 (서브 메뉴/탭 포함)

    노출 가능(is_visible='visible')한 항목만 order_index 순으로 반환합니다.
    인증 없이 호출 가능합니다.

    각 탭의 link_type이 'board'인 경우 href는 /news?board={board_id} 형태로 변환됩니다.
    """
    items = (
        db.query(models.NavMenuItem)
        .options(joinedload(models.NavMenuItem.tabs))
        .filter(models.NavMenuItem.is_visible == "visible")
        .order_by(models.NavMenuItem.order_index)
        .all()
    )
    result = []
    for item in items:
        link = item.link_value
        if item.link_type == "board":
            link = f"/board?board={item.link_value}" if item.link_value else "/board"
        tabs_list = []
        if hasattr(item, "tabs") and item.tabs:
            for t in sorted(item.tabs, key=lambda x: x.order_index):
                if t.is_visible == "visible":
                    tab_link_type = getattr(t, "link_type", "page") or "page"
                    tab_href = t.link_value
                    # 게시판 연결인 경우 URL 변환 (/board?board= 형식)
                    if tab_link_type == "board":
                        tab_href = f"/board?board={t.link_value}" if t.link_value else "/board"
                    tabs_list.append({
                        "label": t.label,
                        "href": tab_href,
                        "linkType": tab_link_type,
                        "linkValue": t.link_value,
                    })
        result.append({
            "id": item.id,
            "name": item.label,
            "icon": item.icon,
            "link": link,
            "linkType": item.link_type,
            "linkValue": item.link_value,
            "matchPaths": [p.strip() for p in (item.match_paths or "").split(",") if p.strip()] or [link],
            "tabs": tabs_list,
        })
    return {"success": True, "data": result}


# =========================================================
# 배너 API
# =========================================================

@router.get("/api/banners")
async def get_banners(
    banner_type: Optional[str] = Query("banner", description="배너 타입 (top_banner, banner)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    배너 목록 조회 API
    
    활성화된 배너만 반환하며, order_index 순으로 정렬됩니다.
    
    Query Parameters:
    - banner_type: 배너 타입 ('top_banner' 또는 'banner', 기본값: 'banner')
    
    응답:
    ```json
    {
        "success": true,
        "data": [
            {
                "id": 1,
                "type": "banner",
                "image_url": "/uploads/banners/image.jpg",
                "link_url": "https://example.com",
                "alt_text": "배너 설명",
                "order_index": 0
            }
        ],
        "count": 1
    }
    ```
    """
    banners = db.query(models.Banner).filter(
        models.Banner.type == banner_type,
        models.Banner.is_active == "active"
    ).order_by(models.Banner.order_index).all()
    
    banners_data = [
        {
            "id": banner.id,
            "type": banner.type,
            "image_url": banner.image_url,
            "link_url": banner.link_url,
            "alt_text": banner.alt_text,
            "order_index": banner.order_index
        }
        for banner in banners
    ]
    
    return {
        "success": True,
        "data": banners_data,
        "count": len(banners_data)
    }


# =========================================================
# Yahoo Finance 공통: 캐시 + 요청 제한
# =========================================================

# 인메모리 캐시 (key → {data, expires})
_yahoo_cache: dict = {}
_YAHOO_CACHE_TTL = 300  # 5분

_YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def _get_cached(key: str):
    entry = _yahoo_cache.get(key)
    if entry and entry["expires"] > time.time():
        return entry["data"]
    return None


def _set_cached(key: str, data):
    _yahoo_cache[key] = {"data": data, "expires": time.time() + _YAHOO_CACHE_TTL}


_yahoo_crumb_cache: dict = {"crumb": None, "cookies": None, "expires": 0}
_YAHOO_CRUMB_TTL = 1800  # 30분


async def _get_yahoo_crumb(client: httpx.AsyncClient):
    """Yahoo Finance crumb + 세션 쿠키 획득 (^GSPC, ^KS11 등 인증 필요 심볼 대응)"""
    if _yahoo_crumb_cache["crumb"] and _yahoo_crumb_cache["expires"] > time.time():
        return _yahoo_crumb_cache["crumb"], _yahoo_crumb_cache["cookies"]
    try:
        r1 = await client.get(
            "https://fc.yahoo.com", headers=_YAHOO_HEADERS,
            timeout=10.0, follow_redirects=True,
        )
        cookies = r1.cookies
        r2 = await client.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            headers=_YAHOO_HEADERS, cookies=cookies,
            timeout=10.0, follow_redirects=True,
        )
        if r2.status_code == 200:
            crumb = r2.text.strip()
            if crumb and len(crumb) < 100:
                _yahoo_crumb_cache["crumb"] = crumb
                _yahoo_crumb_cache["cookies"] = cookies
                _yahoo_crumb_cache["expires"] = time.time() + _YAHOO_CRUMB_TTL
                return crumb, cookies
    except Exception:
        pass
    return None, None


async def _yahoo_fetch_with_retry(
    client: httpx.AsyncClient, url: str, params: dict, max_retries: int = 3,
    crumb: str = None, cookies=None,
):
    """Yahoo Finance API 호출 (crumb 인증 + 429 시 지수 백오프 재시도 + query2 fallback)"""
    if crumb:
        params = {**params, "crumb": crumb}

    # query1 → query2 fallback
    urls = [url]
    if "query1.finance.yahoo.com" in url:
        urls.append(url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"))

    for try_url in urls:
        for attempt in range(max_retries):
            kwargs = {"url": try_url, "params": params, "headers": _YAHOO_HEADERS, "timeout": 10.0}
            if cookies:
                kwargs["cookies"] = cookies
            resp = await client.get(**kwargs)
            if resp.status_code == 429:
                wait = 2 ** attempt  # 1s, 2s, 4s
                await asyncio.sleep(wait)
                continue
            if 500 <= resp.status_code <= 599:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            if resp.status_code >= 400:
                break  # 다음 URL 시도
            return resp.json()
        # 이 URL 실패 → 다음 URL 시도
        continue

    # 모든 시도 실패
    return None


# =========================================================
# 국내지수 API (Yahoo Finance 프록시 - 코스피/코스닥)
# =========================================================

DOMESTIC_INDICES = [
    {"name": "코스피", "symbol": "^KS11"},
    {"name": "코스닥", "symbol": "^KQ11"},
]


@router.get("/api/domestic-indices")
async def get_domestic_indices(
    authorized: bool = Depends(verify_api_key)
):
    """
    Yahoo Finance API를 통해 국내 지수(코스피, 코스닥) 데이터를 조회합니다.
    프론트엔드 StockIndex(국내지수) 컴포넌트에서 사용합니다.
    """
    cached = _get_cached("domestic-indices")
    if cached is not None:
        return cached

    async def fetch_one(client: httpx.AsyncClient, item: dict, crumb=None, cookies=None):
        try:
            symbol = item["symbol"]
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
            params = {"interval": "1d", "range": "1d"}
            data = await _yahoo_fetch_with_retry(client, url, params, crumb=crumb, cookies=cookies)
            if not data or "chart" not in data or "result" not in data["chart"] or not data["chart"]["result"]:
                return None
            result = data["chart"]["result"][0]
            meta = result.get("meta", {})
            current_price = meta.get("regularMarketPrice") or meta.get("previousClose") or meta.get("chartPreviousClose")
            previous_close = meta.get("previousClose") or meta.get("chartPreviousClose")
            if current_price is None or previous_close is None:
                return None
            change = current_price - previous_close
            percent = (change / previous_close * 100) if previous_close != 0 else 0
            return {
                "name": item["name"],
                "value": f"{current_price:,.2f}",
                "change": f"+{change:.2f}" if change >= 0 else f"{change:.2f}",
                "percent": f"+{percent:.2f}%" if percent >= 0 else f"{percent:.2f}%",
                "timestamp": meta.get("regularMarketTime"),
            }
        except Exception:
            return None

    async with httpx.AsyncClient(follow_redirects=True) as client:
        crumb, cookies = await _get_yahoo_crumb(client)
        # 순차 호출 (Yahoo rate limit 방지)
        results = []
        for item in DOMESTIC_INDICES:
            results.append(await fetch_one(client, item, crumb=crumb, cookies=cookies))
            await asyncio.sleep(0.3)

    valid = [r for r in results if r is not None]
    timestamp = ""
    if valid:
        ts_values = [r["timestamp"] for r in valid if r.get("timestamp")]
        if ts_values:
            latest_ts = max(ts_values)
            from datetime import datetime, timezone, timedelta
            dt = datetime.fromtimestamp(latest_ts, tz=timezone.utc)
            kst = dt + timedelta(hours=9)
            timestamp = kst.strftime("%Y-%m-%d %H:%M")
        for r in valid:
            r.pop("timestamp", None)

    result = {
        "success": True,
        "data": valid,
        "timestamp": timestamp,
    }
    _set_cached("domestic-indices", result)
    return result


# =========================================================
# 해외지수 API (Yahoo Finance 프록시)
# =========================================================

@router.get("/api/foreign-indices")
async def get_foreign_indices(
    authorized: bool = Depends(verify_api_key)
):
    """
    Yahoo Finance API를 통해 해외지수 데이터를 조회합니다.
    12개 주요 지수를 순차 조회하여 반환합니다 (rate limit 방지).
    """
    cached = _get_cached("foreign-indices")
    if cached is not None:
        return cached

    # 12개 주요 해외지수 심볼
    indices = [
        {"symbol": "^GSPC", "name": "S&P 500", "market": "US"},
        {"symbol": "^DJI", "name": "다우존스", "market": "US"},
        {"symbol": "^IXIC", "name": "나스닥", "market": "US"},
        {"symbol": "^N225", "name": "닛케이", "market": "JP"},
        {"symbol": "^HSI", "name": "항셍", "market": "HK"},
        {"symbol": "000001.SS", "name": "상하이종합", "market": "CN"},
        {"symbol": "^STOXX50E", "name": "유로스톡스50", "market": "EU"},
        {"symbol": "^FTSE", "name": "FTSE 100", "market": "UK"},
        {"symbol": "^GDAXI", "name": "DAX", "market": "DE"},
        {"symbol": "^FCHI", "name": "CAC 40", "market": "FR"},
        {"symbol": "^RUT", "name": "러셀2000", "market": "US"},
        {"symbol": "^VIX", "name": "VIX", "market": "US"}
    ]

    async def fetch_index_data(client: httpx.AsyncClient, index: dict, crumb=None, cookies=None):
        """개별 지수 데이터를 Yahoo Finance에서 조회"""
        try:
            symbol = index["symbol"]
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
            params = {
                "interval": "1d",
                "range": "5d"
            }

            data = await _yahoo_fetch_with_retry(client, url, params, crumb=crumb, cookies=cookies)

            if data and "chart" in data and "result" in data["chart"] and data["chart"]["result"]:
                result = data["chart"]["result"][0]
                meta = result.get("meta", {})
                quote = result.get("indicators", {}).get("quote", [{}])[0]
                timestamps = result.get("timestamp", [])

                if timestamps and quote.get("close"):
                    latest_idx = -1
                    latest_price = quote["close"][latest_idx]

                    while latest_price is None and abs(latest_idx) <= len(quote["close"]):
                        latest_idx -= 1
                        latest_price = quote["close"][latest_idx] if abs(latest_idx) <= len(quote["close"]) else None

                    prev_idx = latest_idx - 1
                    prev_price = quote["close"][prev_idx] if abs(prev_idx) <= len(quote["close"]) else latest_price

                    while prev_price is None and abs(prev_idx) <= len(quote["close"]):
                        prev_idx -= 1
                        prev_price = quote["close"][prev_idx] if abs(prev_idx) <= len(quote["close"]) else None

                    if latest_price is not None and prev_price is not None:
                        change = latest_price - prev_price
                        change_percent = (change / prev_price * 100) if prev_price != 0 else 0

                        return {
                            "symbol": index["symbol"],
                            "name": index["name"],
                            "market": index["market"],
                            "price": round(latest_price, 2),
                            "change": round(change, 2),
                            "change_percent": round(change_percent, 2),
                            "currency": meta.get("currency", "USD"),
                            "exchange": meta.get("exchangeName", ""),
                            "timestamp": timestamps[latest_idx] if timestamps else None
                        }

            return {
                "symbol": index["symbol"],
                "name": index["name"],
                "market": index["market"],
                "price": None,
                "change": None,
                "change_percent": None,
                "error": "데이터 파싱 실패"
            }

        except httpx.TimeoutException:
            return {
                "symbol": index["symbol"],
                "name": index["name"],
                "market": index["market"],
                "price": None,
                "change": None,
                "change_percent": None,
                "error": "타임아웃"
            }
        except Exception as e:
            return {
                "symbol": index["symbol"],
                "name": index["name"],
                "market": index["market"],
                "price": None,
                "change": None,
                "change_percent": None,
                "error": str(e)
            }

    # 순차 호출 (Yahoo rate limit 방지 - crumb 인증 사용)
    async with httpx.AsyncClient(follow_redirects=True) as client:
        crumb, cookies = await _get_yahoo_crumb(client)
        results = []
        for idx in indices:
            results.append(await fetch_index_data(client, idx, crumb=crumb, cookies=cookies))
            await asyncio.sleep(0.3)

    result = {
        "success": True,
        "data": results,
        "count": len(results)
    }
    _set_cached("foreign-indices", result)
    return result


# =========================================================
# 네이버 증권 랭킹 데이터 API
# =========================================================

@router.get("/api/holidays")
async def get_holidays(
    year: Optional[int] = Query(None, description="조회할 연도 (YYYY)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    공휴일 목록 조회 API

    Schedule 테이블에서 type='api'인 일정(공휴일)을 조회합니다.
    year 파라미터가 없으면 전체 공휴일을 반환합니다.
    """
    try:
        query = db.query(models.Schedule).filter(
            models.Schedule.type == "api"
        )

        if year:
            # 해당 연도의 공휴일만 필터링
            year_start = date(year, 1, 1)
            year_end = date(year, 12, 31)
            query = query.filter(
                models.Schedule.date >= year_start,
                models.Schedule.date <= year_end,
            )

        holidays = query.order_by(models.Schedule.date).all()

        result = [
            {
                "date": serialize_date(h.date),
                "name": h.subject or "공휴일",
                "is_national": True,
            }
            for h in holidays
        ]

        return {
            "success": True,
            "data": result,
            "count": len(result),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"공휴일 데이터 조회 실패: {str(e)}"
        )


@router.get("/api/naver-stock-ranking")
async def get_naver_stock_ranking(
    ranking_type: str = Query(..., description="랭킹 타입: 'volume' (거래량 상위), 'amount' (거래대금 상위), 'search' (검색 상위)"),
    market_type: str = Query("all", description="시장 타입: 'kospi' (코스피), 'kosdaq' (코스닥), 'all' (전체)"),
    collected_time: Optional[str] = Query(None, description="수집 시간대: '11:00', '16:00', '21:00' (None이면 최신 데이터)"),
    limit: int = Query(50, description="조회할 종목 수 (기본값: 50)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    네이버 증권 랭킹 데이터 조회
    
    거래량 상위, 거래대금 상위, 검색 상위 데이터를 조회합니다.
    """
    try:
        # 랭킹 타입 검증
        if ranking_type not in ['volume', 'amount', 'search']:
            raise HTTPException(
                status_code=400,
                detail="랭킹 타입은 'volume', 'amount', 'search' 중 하나여야 합니다."
            )
        
        # 시장 타입 검증
        if market_type not in ['kospi', 'kosdaq', 'all']:
            raise HTTPException(
                status_code=400,
                detail="시장 타입은 'kospi', 'kosdaq', 'all' 중 하나여야 합니다."
            )
        
        # 검색 상위는 시장 타입이 'all'만 가능
        if ranking_type == 'search' and market_type != 'all':
            market_type = 'all'
        
        # 쿼리 구성
        query = db.query(models.NaverStockRanking).filter(
            models.NaverStockRanking.ranking_type == ranking_type,
            models.NaverStockRanking.market_type == market_type,
        )
        
        # 수집 시간대 필터
        if collected_time:
            query = query.filter(models.NaverStockRanking.collected_time == collected_time)
        
        # 최신 데이터 조회 (수집 시간대가 지정되지 않은 경우)
        if not collected_time:
            # 가장 최근 수집 시간대 찾기
            latest_time = db.query(func.max(models.NaverStockRanking.collected_time)).filter(
                models.NaverStockRanking.ranking_type == ranking_type,
                models.NaverStockRanking.market_type == market_type,
            ).scalar()
            
            if latest_time:
                query = query.filter(models.NaverStockRanking.collected_time == latest_time)
        
        # 최신 수집 일시 기준으로 정렬
        latest_date = db.query(func.max(models.NaverStockRanking.collected_at)).filter(
            models.NaverStockRanking.ranking_type == ranking_type,
            models.NaverStockRanking.market_type == market_type,
        ).scalar()
        
        if latest_date:
            query = query.filter(models.NaverStockRanking.collected_at == latest_date)
        
        # 순위로 정렬
        query = query.order_by(models.NaverStockRanking.rank)
        
        # 제한
        rankings = query.limit(limit).all()
        
        # 결과 변환
        results = []
        for ranking in rankings:
            results.append({
                "rank": ranking.rank,
                "stock_code": ranking.stock_code,
                "stock_name": ranking.stock_name,
                "current_price": ranking.current_price,
                "change": ranking.change,
                "change_percent": ranking.change_percent,
                "volume": ranking.volume,
                "amount": ranking.amount,
                "collected_at": ranking.collected_at.isoformat() if ranking.collected_at else None,
                "collected_time": ranking.collected_time,
            })
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "ranking_type": ranking_type,
            "market_type": market_type,
            "collected_time": collected_time or latest_time,
            "collected_at": latest_date.isoformat() if latest_date else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"네이버 증권 랭킹 데이터 조회 실패: {str(e)}"
        )


@router.get("/api/naver-stock-ranking/times")
async def get_naver_stock_ranking_times(
    ranking_type: str = Query(..., description="랭킹 타입: 'volume', 'amount', 'search'"),
    market_type: str = Query("all", description="시장 타입: 'kospi', 'kosdaq', 'all'"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    네이버 증권 랭킹 데이터의 수집 시간대 목록 조회
    """
    try:
        # 검색 상위는 시장 타입이 'all'만 가능
        if ranking_type == 'search' and market_type != 'all':
            market_type = 'all'
        
        # 수집 시간대 목록 조회
        times = db.query(
            models.NaverStockRanking.collected_time,
            func.max(models.NaverStockRanking.collected_at).label('latest_collected_at')
        ).filter(
            models.NaverStockRanking.ranking_type == ranking_type,
            models.NaverStockRanking.market_type == market_type,
        ).group_by(
            models.NaverStockRanking.collected_time
        ).order_by(
            func.max(models.NaverStockRanking.collected_at).desc()
        ).all()
        
        results = []
        for time, latest_date in times:
            results.append({
                "collected_time": time,
                "latest_collected_at": latest_date.isoformat() if latest_date else None,
            })
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"수집 시간대 목록 조회 실패: {str(e)}"
        )