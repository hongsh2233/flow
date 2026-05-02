"""
REST API 라우터 - 프론트엔드용

이 모듈은 외부 애플리케이션에서 데이터를 조회할 수 있도록 RESTful API 엔드포인트를 제공합니다.
주식 데이터(KRX, FSC)는 API Key를 통해 인증하고, 
게시판 및 일정 관리 등은 JWT 토큰 또는 API Key를 통해 인증합니다.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import distinct, cast, Integer, Float, func, or_, and_, text
from typing import Optional
from datetime import datetime, date
import json
import re
import random
import asyncio
import time
import httpx
import pytz

from app.database import get_db
from app import models
from app.routers.board import parse_attached_files, clean_content
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.dependencies import (
    get_current_user,
    get_current_user_from_token,
    get_current_user_from_token_optional,
    get_current_member_from_bearer_optional,
    require_current_member,
    get_admin_session_or_api_key,
    get_current_user_or_api_key_for_fsc,
    verify_api_key,
    API_SECRET_KEY,
)
from app.utils import verify_token
from app.services.api_service import krx_api_service  # 시장현황 데이터 처리를 위한 서비스 임포트
from app.services.member_point_service import grant_post_like_bonus
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


class PollVoteRequest(BaseModel):
    poll_id: int
    option_index: int
    voter_key: Optional[str] = None  # guest_id 또는 "member:{id}" - 1인 1표용


class CreatePostRequest(BaseModel):
    """게시글 작성 요청 (방명록 등)"""
    content: str
    title: Optional[str] = None
    author_email: Optional[str] = None  # 회원 이메일 (Next.js 세션에서 전달)
    reference_text: Optional[str] = None  # 참고 문구
    use_ai_summary: bool = False  # AI 요약 후 등록 여부

# ---------------------------------------------------------
# API 인증 설정
# ---------------------------------------------------------
# verify_api_key는 app.dependencies에서 import하여 사용
# API_SECRET_KEY도 app.dependencies에서 import하여 사용
# 이렇게 하면 환경 변수(NEXT_PUBLIC_X_API_KEY)를 일관되게 사용할 수 있습니다.


def _summarize_content_with_gemini(content: str) -> Optional[str]:
    """Gemini API로 게시글 내용 요약"""
    from app.config import GEMINI_API_KEY, GEMINI_MODEL
    if not GEMINI_API_KEY:
        print("[AI요약] GEMINI_API_KEY 없음, 건너뜀")
        return None
    try:
        from google import genai
        from app.services.gemini_response_utils import extract_text_from_generate_content_response
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = (
            "다음 글의 핵심 내용을 간결하게 요약해주세요. "
            "한국어로 작성하고, 원문의 주요 정보와 의미를 보존해주세요.\n\n"
            f"{content}"
        )
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        text = extract_text_from_generate_content_response(
            response, log_prefix="post-summary", log_if_empty=True
        )
        return text if text else None
    except Exception as e:
        print(f"[AI요약] Gemini 호출 실패: {e}")
        return None


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


def _is_within_period(post) -> bool:
    """제한 기간 내인지 (start/end가 없으면 True)"""
    today = datetime.now(pytz.timezone("Asia/Seoul")).date()
    start = getattr(post, "member_only_start_date", None)
    end = getattr(post, "member_only_end_date", None)
    if start and today < start:
        return False  # 아직 시작 전
    if end and today > end:
        return False  # 기간 만료
    return True


def _effective_is_member_only(post) -> str:
    """회원전용 기간을 고려한 유효 is_member_only 반환"""
    if getattr(post, "is_member_only", None) != "true":
        return "false"
    if not _is_within_period(post):
        return "false"  # 기간 만료 → 공개
    return "true"


def _effective_public_visibility(post) -> str:
    """일부 노출 기간을 고려한 유효 public_visibility 반환"""
    pv = getattr(post, "public_visibility", None) or "full"
    if pv != "partial":
        return pv
    if not _is_within_period(post):
        return "full"  # 기간 만료 → 전체 노출
    return "partial"


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
    srtn_cd: Optional[str] = Query(None, description="단축코드 (특정 종목 조회)"),
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
    
    # 단축코드 필터링 (특정 종목 조회)
    if srtn_cd:
        query = query.filter(models.FscStockPrice.srtn_cd == srtn_cd)
    
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


@router.get("/api/fsc-rising-stocks")
async def get_fsc_rising_stocks(
    bas_dt: Optional[str] = Query(None, description="기준일자 (YYYYMMDD). None이면 최신 데이터"),
    limit: int = Query(100, ge=1, le=500),
    mrkt_ctg: Optional[str] = Query(None, description="시장구분 (KOSPI, KOSDAQ)"),
    order_by: Optional[str] = Query("flt_rt"),
    order_direction: Optional[str] = Query("desc"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    금융위원회 상승종목 조회 (FscRisingStock 테이블)
    """
    query = db.query(models.FscRisingStock)
    if bas_dt:
        query = query.filter(models.FscRisingStock.bas_dt == bas_dt)
    else:
        latest = db.query(func.max(models.FscRisingStock.bas_dt)).scalar()
        if not latest:
            return {"success": True, "data": [], "bas_dt": None, "count": 0}
        query = query.filter(models.FscRisingStock.bas_dt == latest)
        bas_dt = latest
    if mrkt_ctg:
        query = query.filter(models.FscRisingStock.mrkt_ctg == mrkt_ctg)
    all_stocks = query.all()
    reverse_order = order_direction != "asc"
    key_fn = lambda x: float(str(x.flt_rt or "0").replace("%", "").replace("+", "").replace("-", "").strip() or 0)
    sorted_stocks = sorted(all_stocks, key=key_fn, reverse=reverse_order)[:limit]
    result = []
    for i, s in enumerate(sorted_stocks, 1):
        result.append({
            "rank": i,
            "srtn_cd": s.srtn_cd,
            "itms_nm": s.itms_nm,
            "clpr": s.clpr,
            "flt_rt": s.flt_rt,
            "mrkt_tot_amt": s.mrkt_tot_amt,
            "mrkt_ctg": s.mrkt_ctg,
            "bas_dt": s.bas_dt,
        })
    return {"success": True, "data": result, "bas_dt": bas_dt, "count": len(result)}


@router.get("/api/naver-rising-stocks")
async def get_naver_rising_stocks(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    네이버증권 상승종목 조회 (10%이상, 최신 수집 슬롯 기준)
    """
    from app.services.naver_rising_stock_service import get_latest_rising_stocks
    result = get_latest_rising_stocks(db, market_type=market_type.lower(), limit=limit)
    return {"success": True, **result}


@router.get("/api/admin/favorite-stocks-stats")
async def get_favorite_stocks_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    관심종목 통계 - 종목별 등록 회원 수, 인기 순위
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    members = db.query(models.Member).filter(
        models.Member.favorite_stocks.isnot(None),
        models.Member.favorite_stocks != "",
        models.Member.favorite_stocks != "[]",
    ).all()

    stock_counts: dict = {}
    member_details: list = []

    for m in members:
        try:
            stocks = json.loads(m.favorite_stocks) if m.favorite_stocks else []
        except (json.JSONDecodeError, TypeError):
            stocks = []
        if not stocks:
            continue
        member_details.append({
            "email": m.email,
            "nickname": getattr(m, "nickname", None) or m.email,
            "stock_count": len(stocks),
            "stocks": stocks,
        })
        for code in stocks:
            stock_counts[code] = stock_counts.get(code, 0) + 1

    # 인기 종목 TOP (등록 회원 수 기준 내림차순)
    popular = sorted(stock_counts.items(), key=lambda x: x[1], reverse=True)
    popular_list = [{"stock_code": code, "count": cnt} for code, cnt in popular]

    return {
        "success": True,
        "total_members_with_favorites": len(member_details),
        "total_unique_stocks": len(stock_counts),
        "popular_stocks": popular_list,
        "members": member_details,
    }


@router.get("/api/stock-screening/dates")
async def get_stock_screening_dates(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    limit: int = Query(120, ge=1, le=400),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """저장된 일목 스크리닝 기준일 목록 (최신순, BO 전용)."""
    from app.services.stock_screening_service import list_stock_screening_dates
    dates = list_stock_screening_dates(db, market_type=market_type.lower(), limit=limit)
    return {"success": True, "dates": dates}


@router.get("/api/stock-screening")
async def get_stock_screening(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    screening_date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD. 생략 시 최신 수집분 1회만 (앱·일반 조회와 동일)",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """
    조건검색 결과 조회 (익일 매수 후보, 기술적 지표 기반)
    """
    from app.services.stock_screening_service import get_latest_screening_results
    result = get_latest_screening_results(
        db,
        market_type=market_type.lower(),
        limit=limit,
        screening_date=screening_date,
    )
    return {"success": True, **result}


@router.post("/api/stock-screening/run")
async def run_stock_screening_manual(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    조건검색 수동 실행 (테스트용, 백그라운드 실행)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    import asyncio
    from app.services.stock_screening_service import collect_and_save

    async def _run():
        from app.database import SessionLocal
        from app.services.screening_progress import update_progress
        bg_db = SessionLocal()
        try:
            result = await collect_and_save(bg_db)
            print(f"[조건검색] 수동 실행 완료: {result}")
        except Exception as e:
            update_progress("ichimoku", status="error", phase="오류", message=f"실행 오류: {e}")
            print(f"[조건검색] 수동 실행 오류: {e}")
        finally:
            bg_db.close()

    asyncio.create_task(_run())
    return {"success": True, "message": "조건검색 스크리닝이 백그라운드에서 시작되었습니다."}


@router.get("/api/jongbe-screening/dates")
async def get_jongbe_screening_dates(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    limit: int = Query(120, ge=1, le=400),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """저장된 종베 스크리닝 기준일 목록 (최신순, BO 전용)."""
    from app.services.jongbe_screening_service import list_jongbe_screening_dates
    dates = list_jongbe_screening_dates(db, market_type=market_type.lower(), limit=limit)
    return {"success": True, "dates": dates}


@router.get("/api/jongbe-screening")
async def get_jongbe_screening(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    screening_date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD. 생략 시 최신 수집분 1회만",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """
    종베 검색식 결과 조회 (당일 종가매수 후보)
    """
    from app.services.jongbe_screening_service import get_latest_jongbe_results
    result = get_latest_jongbe_results(
        db,
        market_type=market_type.lower(),
        limit=limit,
        screening_date=screening_date,
    )
    return {"success": True, **result}


@router.post("/api/jongbe-screening/run")
async def run_jongbe_screening_manual(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    종베 검색식 수동 실행 (테스트용, 백그라운드 실행)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    import asyncio
    from app.services.jongbe_screening_service import collect_and_save_jongbe

    async def _run():
        from app.database import SessionLocal
        from app.services.screening_progress import update_progress
        bg_db = SessionLocal()
        try:
            result = await collect_and_save_jongbe(bg_db)
            print(f"[종베] 수동 실행 완료: {result}")
        except Exception as e:
            update_progress("jongbe", status="error", phase="오류", message=f"실행 오류: {e}")
            print(f"[종베] 수동 실행 오류: {e}")
        finally:
            bg_db.close()

    asyncio.create_task(_run())
    return {"success": True, "message": "종베 검색식이 백그라운드에서 시작되었습니다. (병렬처리 약 3~5분 소요)"}


@router.get("/api/ricebowl-screening/dates")
async def get_ricebowl_screening_dates(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    limit: int = Query(120, ge=1, le=400),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """저장된 밥그릇 스크리닝 기준일 목록 (최신순, BO 전용)."""
    from app.services.ricebowl_screening_service import list_ricebowl_screening_dates
    dates = list_ricebowl_screening_dates(db, market_type=market_type.lower(), limit=limit)
    return {"success": True, "dates": dates}


@router.get("/api/ricebowl-screening")
async def get_ricebowl_screening(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    screening_date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD. 생략 시 최신 수집분 1회만",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """
    밥그릇(U자형 반등) 검색식 결과 조회 (추세 전환 후보)
    """
    from app.services.ricebowl_screening_service import get_latest_ricebowl_results
    result = get_latest_ricebowl_results(
        db,
        market_type=market_type.lower(),
        limit=limit,
        screening_date=screening_date,
    )
    return {"success": True, **result}


@router.post("/api/ricebowl-screening/run")
async def run_ricebowl_screening_manual(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    밥그릇 검색식 수동 실행 (테스트용, 백그라운드 실행)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    import asyncio
    from app.services.ricebowl_screening_service import collect_and_save_ricebowl

    async def _run():
        from app.database import SessionLocal
        from app.services.screening_progress import update_progress
        bg_db = SessionLocal()
        try:
            result = await collect_and_save_ricebowl(bg_db)
            print(f"[밥그릇] 수동 실행 완료: {result}")
        except Exception as e:
            update_progress("ricebowl", status="error", phase="오류", message=f"실행 오류: {e}")
            print(f"[밥그릇] 수동 실행 오류: {e}")
        finally:
            bg_db.close()

    asyncio.create_task(_run())
    return {"success": True, "message": "밥그릇 검색식이 백그라운드에서 시작되었습니다. (병렬처리 약 3~5분 소요)"}


@router.get("/api/breakout-screening/dates")
async def get_breakout_screening_dates(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    limit: int = Query(120, ge=1, le=400),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """저장된 급등예상 스크리닝 기준일 목록 (최신순, BO 전용)."""
    from app.services.breakout_screening_service import list_breakout_screening_dates
    dates = list_breakout_screening_dates(db, market_type=market_type.lower(), limit=limit)
    return {"success": True, "dates": dates}


@router.get("/api/breakout-screening")
async def get_breakout_screening(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    screening_date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD. 생략 시 최신 수집분 1회만",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """
    매물 소화 돌파(급등 예상) 검색식 결과 조회
    """
    from app.services.breakout_screening_service import get_latest_breakout_results
    result = get_latest_breakout_results(
        db,
        market_type=market_type.lower(),
        limit=limit,
        screening_date=screening_date,
    )
    return {"success": True, **result}


@router.post("/api/breakout-screening/run")
async def run_breakout_screening_manual(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    급등예상 검색식 수동 실행 (테스트용, 백그라운드 실행)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    import asyncio
    from app.services.breakout_screening_service import collect_and_save_breakout

    async def _run():
        from app.database import SessionLocal
        from app.services.screening_progress import update_progress
        bg_db = SessionLocal()
        try:
            result = await collect_and_save_breakout(bg_db)
            print(f"[급등] 수동 실행 완료: {result}")
        except Exception as e:
            update_progress("breakout", status="error", phase="오류", message=f"실행 오류: {e}")
            print(f"[급등] 수동 실행 오류: {e}")
        finally:
            bg_db.close()

    asyncio.create_task(_run())
    return {"success": True, "message": "급등예상 검색식이 백그라운드에서 시작되었습니다. (병렬처리 약 3~5분 소요)"}


@router.get("/api/leader-screening/dates")
async def get_leader_screening_dates(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    limit: int = Query(120, ge=1, le=400),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """저장된 주도주 스크리닝 기준일 목록 (최신순)."""
    from app.services.leader_screening_service import list_leader_screening_dates
    dates = list_leader_screening_dates(db, market_type=market_type.lower(), limit=limit)
    return {"success": True, "dates": dates}


@router.get("/api/leader-screening")
async def get_leader_screening(
    market_type: str = Query("kospi", description="시장구분 (kospi | kosdaq)"),
    screening_date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD. 생략 시 최신 수집분 1회만",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth=Depends(get_admin_session_or_api_key),
):
    """
    주도주 검색식 결과 조회
    """
    from app.services.leader_screening_service import get_latest_leader_results
    result = get_latest_leader_results(
        db,
        market_type=market_type.lower(),
        limit=limit,
        screening_date=screening_date,
    )
    return {"success": True, **result}


@router.post("/api/leader-screening/run")
async def run_leader_screening_manual(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    주도주 검색식 수동 실행 (테스트용, 백그라운드 실행)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    import asyncio
    from app.services.leader_screening_service import collect_and_save_leader

    async def _run():
        from app.database import SessionLocal
        from app.services.screening_progress import update_progress
        bg_db = SessionLocal()
        try:
            result = await collect_and_save_leader(bg_db)
            print(f"[주도주] 수동 실행 완료: {result}")
        except Exception as e:
            update_progress("leader", status="error", phase="오류", message=f"실행 오류: {e}")
            print(f"[주도주] 수동 실행 오류: {e}")
        finally:
            bg_db.close()

    asyncio.create_task(_run())
    return {"success": True, "message": "주도주 검색식이 백그라운드에서 시작되었습니다. (병렬처리 약 3~5분 소요)"}


@router.get("/api/screening-progress")
async def get_screening_progress(
    screening_type: str = Query(..., description="스크리닝 타입 (ichimoku | jongbe | ricebowl | breakout | leader)"),
    user=Depends(get_current_user),
):
    """
    스크리닝 진행 상황 조회 (프론트엔드 폴링용)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    from app.services.screening_progress import get_progress
    return get_progress(screening_type)


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
# 네이버 수급 동향 API (API Key 인증)
# =========================================================

@router.get("/api/naver-supply-data")
async def get_naver_supply_data_public(
    data_type: str = Query("investor_day", description="데이터 타입 (investor_day, investor_time, deal_rank, program_day, program_time 등)"),
    market: str = Query("kospi", description="시장구분 (kospi, kosdaq, futures, all)"),
    sub_key: Optional[str] = Query(
        default=None,
        description="서브 키 (deal_rank: foreign_buy/foreign_sell/inst_buy/inst_sell 등, 그 외에는 보통 None)",
    ),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    네이버 수급 동향 데이터 조회 (공개용, API Key 인증)

    - investor_day / investor_time: 투자자별 매매동향 (일자별 / 시간별)
    - deal_rank: 수급 순위 (외인/기관 순매수·순매도, sub_key로 구분)
    - program_day / program_time: 프로그램 매매 (일자별 / 시간별)

    가장 최근(collected_at 기준) 1건만 반환합니다.
    """
    from app.models import NaverSupplyData
    import json as _json

    try:
        q = db.query(NaverSupplyData).filter(
            NaverSupplyData.data_type == data_type,
            NaverSupplyData.market == market,
        )

        if sub_key is not None:
            q = q.filter(NaverSupplyData.sub_key == sub_key)
        else:
            q = q.filter(NaverSupplyData.sub_key.is_(None))

        row = q.order_by(NaverSupplyData.collected_at.desc()).first()
        if not row:
            return {
                "success": True,
                "data": None,
                "bizdate": None,
                "collected_time": None,
                "collected_at": None,
            }

        parsed = _json.loads(row.data_json) if row.data_json else {}
        return {
            "success": True,
            "data": parsed,
            "bizdate": row.bizdate,
            "collected_time": row.collected_time,
            "collected_at": row.collected_at.isoformat() if row.collected_at else None,
        }
    except Exception as e:
        return {"success": False, "data": None, "message": str(e)}


@router.get("/api/supply-summary-ai")
async def get_supply_summary_ai(
    bizdate: Optional[str] = Query(default=None, description="YYYYMMDD, 미입력 시 최신"),
    collected_time: Optional[str] = Query(default=None, description="HH:MM, 미입력 시 최신"),
    market: Optional[str] = Query(
        default=None,
        description="kospi | kosdaq | all, 미입력 시 시장 구분 없이 최신 1건",
    ),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    수급 동향 Gemini AI 요약 조회 (공개용, API Key 인증)
    bizdate, collected_time, market 미입력 시 가장 최근 1건 반환.
    """
    from app.engine.models import SupplySummaryAi

    try:
        q = db.query(SupplySummaryAi).filter(SupplySummaryAi.ai_summary.isnot(None))
        if bizdate:
            q = q.filter(SupplySummaryAi.bizdate == bizdate)
        if collected_time:
            q = q.filter(SupplySummaryAi.collected_time == collected_time)
        if market:
            q = q.filter(SupplySummaryAi.market == market)
        row = q.order_by(SupplySummaryAi.created_at.desc()).first()
        if not row:
            return {
                "success": True,
                "ai_summary": None,
                "bizdate": None,
                "collected_time": None,
                "market": None,
            }
        return {
            "success": True,
            "ai_summary": row.ai_summary,
            "bizdate": row.bizdate,
            "collected_time": row.collected_time,
            "market": row.market,
        }
    except Exception as e:
        return {"success": False, "ai_summary": None, "message": str(e)}


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

@router.get("/api/main-posts")
async def get_main_posts(
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """메인 노출 게시글 (show_on_main=true) - 해외지수 위 카드뉴스용"""
    posts = (
        db.query(models.Post)
        .filter(models.Post.show_on_main == True)
        .order_by(models.Post.updated_at.desc(), models.Post.created_at.desc())
        .limit(limit)
        .all()
    )
    def _strip_html(text: str) -> str:
        if not text:
            return ""
        t = re.sub(r"<[^>]+>", "", text)
        t = t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        t = t.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
        return t.strip()

    result = []
    for post in posts:
        attachments = parse_attached_files(post.content or "")
        cleaned = clean_content(post.content or "")
        cleaned = _strip_html(cleaned)
        result.append({
            "id": post.id,
            "board_id": post.board_id,
            "title": post.title,
            "content": cleaned[:200] + ("..." if len(cleaned) > 200 else ""),
            "author": post.author,
            "views": post.views or 0,
            "created_at": serialize_datetime(post.created_at),
            "updated_at": serialize_datetime(post.updated_at),
            "attachments": attachments,
        })
    return {"success": True, "data": result}


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
            "is_member_only": _effective_is_member_only(post),
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


@router.post("/api/boards/{board_id}/posts")
async def create_board_post(
    board_id: str,
    body: CreatePostRequest,
    db: Session = Depends(get_db),
    auth=Depends(get_current_user_or_api_key),
):
    """게시글 작성 (방명록 등, API Key + author_email로 회원 작성)"""
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")

    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="내용을 입력해 주세요.")

    # AI 요약: 참고 문구가 없고 use_ai_summary가 True인 경우 Gemini로 요약
    if body.use_ai_summary and not (body.reference_text or "").strip():
        summarized = _summarize_content_with_gemini(content)
        if summarized:
            content = summarized

    # 방명록: 제목 자동 생성
    title = body.title
    if not title:
        title = content[:20] + "..." if len(content) > 20 else content

    # 작성자: author_email이 있으면 회원 닉네임/이름 사용, 없으면 "익명"
    author = "익명"
    if body.author_email:
        member = db.query(models.Member).filter(models.Member.email == body.author_email).first()
        if member:
            author = member.nickname or member.name or body.author_email.split("@")[0]

    new_post = models.Post(
        board_id=board_id,
        title=title,
        content=content,
        author=author,
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return {
        "success": True,
        "data": {
            "id": new_post.id,
            "board_id": new_post.board_id,
            "title": new_post.title,
            "content": new_post.content,
            "author": new_post.author,
            "created_at": serialize_datetime(new_post.created_at),
        },
    }


# =========================================================
# 투표 API (별도 Poll 모듈)
# =========================================================

@router.get("/api/polls/active")
async def get_active_poll(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    현재 진행중인 투표 1건 조회 (게시기간 내)
    stock-chat 등 프론트엔드에서 사용
    """
    from app.models import Poll
    from datetime import date
    today = datetime.now(pytz.timezone("Asia/Seoul")).date()
    poll = (
        db.query(Poll)
        .filter(Poll.start_date <= today, Poll.end_date >= today)
        .order_by(Poll.start_date.desc())
        .first()
    )
    if not poll:
        return {"success": True, "data": None}
    options = sorted(poll.options or [], key=lambda o: o.order_index)
    return {
        "success": True,
        "data": {
            "id": poll.id,
            "title": poll.title,
            "description": poll.description or "",
            "start_date": serialize_date(poll.start_date),
            "end_date": serialize_date(poll.end_date),
            "options": [{"order_index": o.order_index, "text": o.text} for o in options],
        },
    }


@router.post("/api/poll-vote")
async def poll_vote(
    body: PollVoteRequest,
    db: Session = Depends(get_db),
    authorized: str = Depends(verify_api_key),
):
    """
    투표 집계 API (1인 1표)

    - poll_id: Poll.id (별도 투표 모듈)
    - option_index: 선택지 인덱스 (0,1,2,...)
    - voter_key: 투표자 식별 (guest_id 또는 "member:{id}") - 없으면 중복 투표 허용(레거시)
    """
    from app.models import PollVote

    if body.option_index < 0:
        raise HTTPException(status_code=400, detail="option_index는 0 이상의 정수여야 합니다.")

    voter_key = (body.voter_key or "").strip()
    if voter_key:
        # 1인 1표: 이미 투표했으면 현재 집계만 반환
        r = db.execute(text("""
            SELECT option_index FROM poll_vote_records
            WHERE poll_id = :poll_id AND voter_key = :voter_key
        """), {"poll_id": body.poll_id, "voter_key": voter_key})
        prev_rec = r.fetchone()
        if prev_rec:
            rows = db.query(PollVote).filter(PollVote.poll_id == body.poll_id).all()
            options = [{"option_index": r.option_index, "vote_count": r.vote_count} for r in rows]
            total = sum(r["vote_count"] for r in options)
            return {
                "success": True,
                "already_voted": True,
                "poll_id": body.poll_id,
                "total_votes": total,
                "options": options,
                "user_voted_option_index": prev_rec[0],
            }

    try:
        row = (
            db.query(PollVote)
            .filter(
                PollVote.poll_id == body.poll_id,
                PollVote.option_index == body.option_index,
            )
            .with_for_update()
            .first()
        )
        if row:
            row.vote_count += 1
        else:
            row = PollVote(
                poll_id=body.poll_id,
                option_index=body.option_index,
                vote_count=1,
            )
            db.add(row)
        if voter_key:
            db.execute(text("""
                INSERT INTO poll_vote_records (poll_id, voter_key, option_index)
                VALUES (:poll_id, :voter_key, :option_index)
                ON CONFLICT (poll_id, voter_key) DO NOTHING
            """), {"poll_id": body.poll_id, "voter_key": voter_key, "option_index": body.option_index})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"투표 저장 중 오류가 발생했습니다: {e}")

    # 최신 집계 결과 반환
    rows = db.query(PollVote).filter(PollVote.poll_id == body.poll_id).all()
    options = [
        {"option_index": r.option_index, "vote_count": r.vote_count}
        for r in rows
    ]
    total = sum(r["vote_count"] for r in options)
    return {
        "success": True,
        "poll_id": body.poll_id,
        "total_votes": total,
        "options": options,
    }


@router.get("/api/poll-stats")
async def poll_stats(
    poll_id: int = Query(..., description="투표 ID (Poll.id)"),
    voter_key: Optional[str] = Query(None, description="투표자 식별 (이미 투표 여부 확인용)"),
    db: Session = Depends(get_db),
    authorized: str = Depends(verify_api_key),
):
    """
    투표 집계 조회 API (Poll.id 기준)
    voter_key가 있으면 해당 투표자의 투표 여부(user_voted_option_index) 포함
    """
    from app.models import PollVote

    rows = db.query(PollVote).filter(PollVote.poll_id == poll_id).all()
    options = [
        {"option_index": r.option_index, "vote_count": r.vote_count}
        for r in rows
    ]
    total = sum(r["vote_count"] for r in options)

    result = {
        "success": True,
        "poll_id": poll_id,
        "total_votes": total,
        "options": options,
    }
    if voter_key and voter_key.strip():
        r = db.execute(text("""
            SELECT option_index FROM poll_vote_records
            WHERE poll_id = :poll_id AND voter_key = :voter_key
        """), {"poll_id": poll_id, "voter_key": voter_key.strip()})
        row = r.fetchone()
        if row:
            result["user_voted_option_index"] = row[0]
    return result


@router.get("/api/posts/{post_id}")
async def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key),
    member = Depends(get_current_member_from_bearer_optional),
):
    """게시글 상세 조회"""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    board = post.board if post.board else db.query(models.Board).filter(models.Board.id == post.board_id).first()
    boost = board and (getattr(board, "random_view_boost", None) or "false") == "true"
    delta = random.randint(1, 8) if boost else 1
    post.views = (post.views or 0) + delta
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
    
    like_count = (
        db.query(func.count(models.PostLike.id))
        .filter(models.PostLike.post_id == post_id)
        .scalar()
        or 0
    )
    liked_by_me = False
    if member:
        liked_by_me = (
            db.query(models.PostLike.id)
            .filter(
                models.PostLike.post_id == post_id,
                models.PostLike.member_id == member.id,
            )
            .first()
            is not None
        )

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
        "like_count": int(like_count),
        "liked_by_me": liked_by_me,
        "is_secret": post.is_secret or "false",
        "is_member_only": _effective_is_member_only(post),
        "member_only_grade": getattr(post, "member_only_grade", None) or "all",
        "public_visibility": _effective_public_visibility(post),
        "created_at": serialize_datetime(post.created_at),
        "updated_at": serialize_datetime(post.updated_at),
        "attachments": attachments
    }
    
    print(f"응답 데이터 attachments 필드: {response_data.get('attachments')}")
    
    return {
        "success": True,
        "data": response_data
    }


@router.post("/api/posts/{post_id}/like")
async def post_toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    member=Depends(require_current_member),
):
    """게시글 좋아요 — 로그인 회원만, 게시글당 1회(중복 요청은 현재 상태 반환)."""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if getattr(post, "status", None) and post.status != "approved":
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    existing = (
        db.query(models.PostLike)
        .filter(
            models.PostLike.post_id == post_id,
            models.PostLike.member_id == member.id,
        )
        .first()
    )
    if existing:
        like_count = (
            db.query(func.count(models.PostLike.id))
            .filter(models.PostLike.post_id == post_id)
            .scalar()
            or 0
        )
        return {
            "success": True,
            "like_count": int(like_count),
            "liked_by_me": True,
            "already_liked": True,
        }

    db.add(models.PostLike(post_id=post_id, member_id=member.id))
    db.commit()
    grant_post_like_bonus(db, member.id, post_id)
    like_count = (
        db.query(func.count(models.PostLike.id))
        .filter(models.PostLike.post_id == post_id)
        .scalar()
        or 0
    )
    return {
        "success": True,
        "like_count": int(like_count),
        "liked_by_me": True,
        "already_liked": False,
    }


# =========================================================
# 알림 API (Token 또는 API Key 인증)
# =========================================================

class MarkReadRequest(BaseModel):
    notification_ids: list[int]


from fastapi import Request as _Request
from fastapi.security import HTTPBearer as _HTTPBearer, HTTPAuthorizationCredentials as _HTTPAuthCreds

_bearer = _HTTPBearer(auto_error=False)


async def _get_notification_email(
    request: _Request,
    credentials: Optional[_HTTPAuthCreds] = Depends(_bearer),
    email: Optional[str] = Query(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY"),
) -> str:
    """
    Bearer JWT 우선으로 이메일 추출. 없으면 API Key + email 쿼리 파라미터로 폴백.
    이메일을 URL 파라미터로 받아 타인의 알림을 조회하는 버그를 차단.
    """
    if credentials and credentials.credentials:
        payload = verify_token(credentials.credentials)
        if payload and payload.get("type") == "member":
            return payload.get("sub", "")
    if x_api_key and x_api_key.strip() == API_SECRET_KEY:
        return email or ""
    raise HTTPException(status_code=401, detail="Not authenticated")


@router.get("/api/notifications")
async def get_notifications(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    email: str = Depends(_get_notification_email),
):
    """최근 알림 목록 조회 (최대 30일 이내, 개인 알림은 본인만)"""
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=30)

    notifications = db.query(models.Notification).filter(
        models.Notification.created_at >= cutoff,
        or_(
            models.Notification.is_global == "true",
            and_(
                models.Notification.is_global == "false",
                models.Notification.target_email == email,
            ),
        ),
    ).order_by(models.Notification.created_at.desc()).limit(limit).all()

    read_ids: set[int] = set()
    if email:
        reads = db.query(models.NotificationRead.notification_id).filter(
            models.NotificationRead.member_email == email,
            models.NotificationRead.notification_id.in_([n.id for n in notifications]),
        ).all()
        read_ids = {r[0] for r in reads}

    return {
        "success": True,
        "data": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "link_url": n.link_url,
                "is_read": n.id in read_ids,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
        "unread_count": sum(1 for n in notifications if n.id not in read_ids),
    }


@router.post("/api/notifications/read")
async def mark_notifications_read(
    body: MarkReadRequest,
    db: Session = Depends(get_db),
    email: str = Depends(_get_notification_email),
):
    """알림 읽음 처리"""
    if not email:
        return {"success": False, "message": "이메일 정보가 없습니다."}

    for nid in body.notification_ids:
        existing = db.query(models.NotificationRead).filter(
            models.NotificationRead.notification_id == nid,
            models.NotificationRead.member_email == email,
        ).first()
        if not existing:
            db.add(models.NotificationRead(notification_id=nid, member_email=email))

    db.commit()
    return {"success": True}


@router.post("/api/notifications/read-all")
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    email: str = Depends(_get_notification_email),
):
    """모든 알림 읽음 처리"""
    if not email:
        return {"success": False, "message": "이메일 정보가 없습니다."}

    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=30)
    notifications = db.query(models.Notification.id).filter(
        models.Notification.created_at >= cutoff,
    ).all()

    for (nid,) in notifications:
        existing = db.query(models.NotificationRead).filter(
            models.NotificationRead.notification_id == nid,
            models.NotificationRead.member_email == email,
        ).first()
        if not existing:
            db.add(models.NotificationRead(notification_id=nid, member_email=email))

    db.commit()
    return {"success": True}


# =========================================================
# 일정 알림 신청 API
# =========================================================

VALID_TIMING = {"1min", "30min", "1day", "2day"}

class ScheduleAlarmRequest(BaseModel):
    schedule_id: int
    timing: str  # "1min" | "30min" | "1day" | "2day"


@router.post("/api/schedule-alarms")
async def subscribe_schedule_alarm(
    body: ScheduleAlarmRequest,
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key),
):
    """일정 알림 신청"""
    if not email:
        return {"success": False, "message": "email 파라미터가 필요합니다."}
    if body.timing not in VALID_TIMING:
        return {"success": False, "message": f"timing은 {VALID_TIMING} 중 하나여야 합니다."}

    schedule = db.query(models.Schedule).filter(models.Schedule.id == body.schedule_id).first()
    if not schedule:
        return {"success": False, "message": "일정을 찾을 수 없습니다."}

    existing = db.query(models.ScheduleAlarmSubscription).filter(
        models.ScheduleAlarmSubscription.member_email == email,
        models.ScheduleAlarmSubscription.schedule_id == body.schedule_id,
    ).first()

    if existing:
        existing.timing = body.timing
        existing.notified = "false"
        db.commit()
        return {"success": True, "action": "updated"}

    sub = models.ScheduleAlarmSubscription(
        member_email=email,
        schedule_id=body.schedule_id,
        timing=body.timing,
    )
    db.add(sub)
    db.commit()
    return {"success": True, "action": "created"}


@router.delete("/api/schedule-alarms/{schedule_id}")
async def unsubscribe_schedule_alarm(
    schedule_id: int,
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key),
):
    """일정 알림 취소"""
    if not email:
        return {"success": False, "message": "email 파라미터가 필요합니다."}

    deleted = db.query(models.ScheduleAlarmSubscription).filter(
        models.ScheduleAlarmSubscription.member_email == email,
        models.ScheduleAlarmSubscription.schedule_id == schedule_id,
    ).first()

    if deleted:
        db.delete(deleted)
        db.commit()
    return {"success": True}


@router.get("/api/schedule-alarms")
async def get_schedule_alarms(
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key),
):
    """내 일정 알림 신청 목록 조회"""
    if not email:
        return {"success": True, "data": []}

    subs = db.query(models.ScheduleAlarmSubscription).filter(
        models.ScheduleAlarmSubscription.member_email == email,
    ).all()

    return {
        "success": True,
        "data": [
            {
                "id": s.id,
                "schedule_id": s.schedule_id,
                "timing": s.timing,
                "notified": s.notified,
            }
            for s in subs
        ],
    }


# =========================================================
# FCM 토큰 관리 API (Capacitor APK용)
# =========================================================

class FcmTokenRequest(BaseModel):
    email: Optional[str] = None  # 비로그인 시 생략 가능
    token: Optional[str] = None


@router.post("/api/fcm-token")
async def register_fcm_token(
    body: FcmTokenRequest,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key),
):
    """FCM 토큰 등록/갱신 (로그인 여부 무관, 디바이스 단위 등록)"""
    if not body.token:
        return {"success": False, "message": "token이 필요합니다."}
    existing = db.query(models.MemberFcmToken).filter(
        models.MemberFcmToken.token == body.token,
    ).first()

    if existing:
        # 로그인 후 email이 새로 들어오면 갱신
        if body.email and existing.member_email != body.email:
            existing.member_email = body.email
            db.commit()
    else:
        db.add(models.MemberFcmToken(member_email=body.email or None, token=body.token))
        db.commit()
    return {"success": True}


@router.delete("/api/fcm-token")
async def delete_fcm_token(
    body: FcmTokenRequest,
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key),
):
    """FCM 토큰 삭제 (알림 OFF)
    - token 지정: 해당 토큰 삭제
    - email만: 해당 email의 모든 토큰 삭제
    """
    if body.token:
        db.query(models.MemberFcmToken).filter(
            models.MemberFcmToken.token == body.token
        ).delete()
    elif body.email:
        db.query(models.MemberFcmToken).filter(
            models.MemberFcmToken.member_email == body.email
        ).delete()
    db.commit()
    return {"success": True}


# =========================================================
# 팝업 API (Token 또는 API Key 인증)
# =========================================================

@router.get("/api/popups/active")
async def get_active_popups(
    db: Session = Depends(get_db),
    auth = Depends(get_current_user_or_api_key)
):
    """현재 게시 중인 활성 팝업 목록 조회"""
    now = datetime.utcnow()
    popups = db.query(models.Popup).filter(
        models.Popup.is_active == "active",
        models.Popup.start_date <= now,
        models.Popup.end_date >= now,
    ).order_by(models.Popup.order_index, models.Popup.id.desc()).all()

    return {
        "success": True,
        "data": [
            {
                "id": p.id,
                "title": p.title,
                "content_type": p.content_type,
                "html_content": p.html_content,
                "image_url": p.image_url,
                "link_url": p.link_url,
                "start_date": p.start_date.isoformat() if p.start_date else None,
                "end_date": p.end_date.isoformat() if p.end_date else None,
            }
            for p in popups
        ],
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
            # 기간 일정(end_date 있음): end_date >= start (범위가 겹침)
            # 단일 일정(end_date 없음): date >= start
            query = query.filter(
                or_(
                    models.Schedule.end_date >= start,
                    and_(models.Schedule.end_date == None, models.Schedule.date >= start),
                )
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="잘못된 시작 날짜 형식입니다. (YYYY-MM-DD)")

    if end_date:
        try:
            end = date.fromisoformat(end_date)
            query = query.filter(models.Schedule.date <= end)
        except ValueError:
            raise HTTPException(status_code=400, detail="잘못된 종료 날짜 형식입니다. (YYYY-MM-DD)")
    
    if type:
        if type == "etc":
            # 기타 = etc + manual (구 호환)
            query = query.filter(models.Schedule.type.in_(["etc", "manual"]))
        else:
            query = query.filter(models.Schedule.type == type)
    
    schedules = query.order_by(models.Schedule.date).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": schedule.id,
                "date": serialize_date(schedule.date),
                "end_date": serialize_date(schedule.end_date) if getattr(schedule, "end_date", None) else None,
                "scheduled_time": getattr(schedule, "scheduled_time", None) or "",
                "subject": schedule.subject,
                "content": schedule.content or "",
                "detail": getattr(schedule, "detail", None) or "",
                "type": schedule.type,
                "link_url": getattr(schedule, "link_url", None) or "",
                "show_main_popup": getattr(schedule, "show_main_popup", False) or False,
                "created_at": serialize_datetime(schedule.created_at),
                "updated_at": serialize_datetime(schedule.updated_at)
            }
            for schedule in schedules
        ],
        "count": len(schedules)
    }


@router.get("/api/schedules/today-popup")
async def get_today_popup_schedules(
    db: Session = Depends(get_db),
    auth=Depends(get_current_user_or_api_key)
):
    """당일 메인 팝업 표시 대상 일정 조회 (show_main_popup=true, 오늘 날짜 포함)"""
    today = datetime.now(pytz.timezone("Asia/Seoul")).date()
    schedules = db.query(models.Schedule).filter(
        models.Schedule.show_main_popup == True,
        models.Schedule.date <= today,
        or_(
            and_(models.Schedule.end_date == None, models.Schedule.date == today),
            and_(models.Schedule.end_date != None, models.Schedule.end_date >= today),
        ),
    ).order_by(models.Schedule.date).all()
    return {
        "success": True,
        "data": [
            {
                "id": s.id,
                "date": serialize_date(s.date),
                "end_date": serialize_date(s.end_date) if getattr(s, "end_date", None) else None,
                "scheduled_time": getattr(s, "scheduled_time", None) or "",
                "subject": s.subject,
                "content": s.content or "",
                "detail": getattr(s, "detail", None) or "",
                "type": s.type,
                "link_url": getattr(s, "link_url", None) or "",
            }
            for s in schedules
        ],
        "count": len(schedules),
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
            "end_date": serialize_date(schedule.end_date) if getattr(schedule, "end_date", None) else None,
            "scheduled_time": getattr(schedule, "scheduled_time", None) or "",
            "subject": schedule.subject,
            "content": schedule.content or "",
            "detail": getattr(schedule, "detail", None) or "",
            "type": schedule.type,
            "link_url": getattr(schedule, "link_url", None) or "",
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

    각 탭의 link_type이 'board'인 경우 href는 /board?board={board_id} 형태로 변환됩니다.
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
            link = f"/board?board={item.link_value}" if item.link_value else "/news"
        tabs_list = []
        if hasattr(item, "tabs") and item.tabs:
            for t in sorted(item.tabs, key=lambda x: x.order_index):
                if t.is_visible == "visible":
                    tab_link_type = getattr(t, "link_type", "page") or "page"
                    tab_href = t.link_value
                    # 게시판 연결인 경우 URL 변환
                    if tab_link_type == "board":
                        tab_href = f"/board?board={t.link_value}" if t.link_value else "/news"
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


@router.get("/api/affiliate-products")
async def get_affiliate_products(
    include_inactive: bool = Query(False, description="true면 비활성 항목 포함"),
    zone: str = Query("A", description="광고 구역: A(기본) 또는 B"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    광고설정에 등록한 알리익스프레스(등) 어필리에이트 상품 목록.
    웹 앱에서 프로모 카드 등으로 사용할 때 `X-API-KEY`로 호출.
    zone=A (기본): ad_zone이 NULL 또는 "A"인 항목
    zone=B: ad_zone이 "B"인 항목
    """
    q = db.query(models.AliexpressAffiliateProduct).order_by(
        models.AliexpressAffiliateProduct.order_index,
        models.AliexpressAffiliateProduct.id,
    )
    if not include_inactive:
        q = q.filter(models.AliexpressAffiliateProduct.is_active == "active")
    if zone == "B":
        q = q.filter(models.AliexpressAffiliateProduct.ad_zone == "B")
    else:
        q = q.filter(
            (models.AliexpressAffiliateProduct.ad_zone == None) |
            (models.AliexpressAffiliateProduct.ad_zone == "A")
        )
    rows = q.all()
    data = [
        {
            "id": r.id,
            "platform": r.platform,
            "external_product_id": r.external_product_id,
            "image_url": r.image_url,
            "video_url": r.video_url,
            "title": r.title,
            "original_price": r.original_price,
            "sale_price": r.sale_price,
            "discount_percent": r.discount_percent,
            "currency_code": r.currency_code,
            "stat_rating_primary": r.stat_rating_primary,
            "stat_commission_primary": r.stat_commission_primary,
            "stat_rating_secondary": r.stat_rating_secondary,
            "stat_commission_secondary": r.stat_commission_secondary,
            "sold_count": r.sold_count,
            "feedback_percent": r.feedback_percent,
            "affiliate_url": r.affiliate_url,
            "ad_zone": r.ad_zone,
            "order_index": r.order_index,
        }
        for r in rows
    ]
    return {"success": True, "data": data, "count": len(data)}


@router.get("/api/banners/managed")
async def get_managed_banners(
    page_path: str = Query(..., description="노출할 페이지 경로 (예: /, /stocks, /news)"),
    position: Optional[str] = Query(None, description="노출 위치: top(상단) 또는 bottom(하단). 미지정 시 전체 반환"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    배너관리에서 등록한 배너를 페이지 경로로 조회

    - page_path: 현재 페이지 경로 (예: /, /stocks). 해당 경로가 노출 대상에 포함된 배너만 반환
    - position: top(상단) 또는 bottom(하단). 미지정 시 전체 반환
    - 1개형(single)은 개별 항목, 슬라이드형(slide)은 slide_group별로 묶어서 반환
    """
    if not page_path.startswith("/"):
        page_path = "/" + page_path
    banners = (
        db.query(models.Banner)
        .filter(
            models.Banner.type == "managed",
            models.Banner.is_active == "active"
        )
        .order_by(models.Banner.order_index)
        .all()
    )
    matched = []
    for b in banners:
        paths_raw = getattr(b, "page_paths", None)
        if not paths_raw:
            continue
        try:
            paths = json.loads(paths_raw) if isinstance(paths_raw, str) else paths_raw
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(paths, list):
            continue
        if page_path not in paths:
            continue
        # position 필터: 값이 없으면 'top'으로 간주 (기존 데이터 호환)
        b_position = getattr(b, "position", None) or "top"
        if position and b_position != position:
            continue
        matched.append(b)
    # slide_group별로 묶기
    singles = [b for b in matched if getattr(b, "display_type", "single") == "single"]
    slide_groups = {}
    for b in matched:
        if getattr(b, "display_type", "single") == "slide":
            sg = getattr(b, "slide_group", None) or "default"
            if sg not in slide_groups:
                slide_groups[sg] = []
            slide_groups[sg].append(b)
    slides = [{"slide_group": k, "items": v} for k, v in sorted(slide_groups.items(), key=lambda x: x[1][0].order_index)]
    def _item(b):
        return {
            "id": b.id,
            "display_type": getattr(b, "display_type", "single"),
            "content_type": getattr(b, "content_type", "image"),
            "image_url": b.image_url,
            "html_content": getattr(b, "html_content", None),
            "link_url": b.link_url or None,
            "alt_text": b.alt_text or None,
            "order_index": b.order_index,
            "slide_group": getattr(b, "slide_group", None),
            "position": getattr(b, "position", None) or "top",
        }
    return {
        "success": True,
        "data": {
            "singles": [_item(b) for b in singles],
            "slides": [{"slide_group": s["slide_group"], "items": [_item(b) for b in s["items"]]} for s in slides],
        },
        "count": len(matched),
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
# 국내지수 API (네이버 모바일 + domestic_index_snapshots)
# =========================================================

@router.get("/api/domestic-indices")
async def get_domestic_indices(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    국내 지수(코스피, 코스닥): 네이버 모바일 API 조회 결과를 domestic_index_snapshots에 저장하고,
    당일 최신 배치가 5분 이내면 DB에서 응답(네이버 호출 생략).
    """
    cached = _get_cached("domestic-indices")
    if cached is not None:
        return cached

    from app.services.domestic_index_service import (
        fetch_and_persist_domestic_indices_async,
        load_latest_domestic_api_payload_from_db,
    )

    kst = pytz.timezone("Asia/Seoul")
    today_kst = datetime.now(kst).date()
    from_db = load_latest_domestic_api_payload_from_db(db, today_kst)
    if from_db:
        _set_cached("domestic-indices", from_db)
        return from_db

    result = await fetch_and_persist_domestic_indices_async(db)
    if result and result.get("success"):
        _set_cached("domestic-indices", result)
        return result

    return {"success": False, "data": [], "timestamp": ""}


# =========================================================
# 해외지수 API (Yahoo Finance 프록시)
# =========================================================

@router.get("/api/foreign-indices")
async def get_foreign_indices(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    해외지수 데이터 조회.
    - DB에 저장된 데이터가 있으면 반환 (00:00, 05:00, 06:30 KST 수집분)
    - 없으면 Yahoo Finance 실시간 조회 (fallback)
    """
    # 1) DB에서 최신 해외지수 조회 (group='foreign')
    try:
        latest = db.query(func.max(models.YahooIndexSnapshot.collected_at)).filter(
            models.YahooIndexSnapshot.group == "foreign"
        ).scalar()
        if latest:
            rows = db.query(models.YahooIndexSnapshot).filter(
                models.YahooIndexSnapshot.group == "foreign",
                models.YahooIndexSnapshot.collected_at == latest,
            ).all()
            # 미국지수(나스닥/S&P500/다우존스) 우선 정렬, 한국지수(코스피/코스닥/코스피200/MSCI Korea) 포함
            _FOREIGN_ORDER = {"^IXIC": 0, "^GSPC": 1, "^DJI": 2, "^SOX": 3, "^RUT": 4, "^VIX": 5,
                             "^KS11": 6, "^KQ11": 7, "^KS200": 8, "^MSKR": 9, "EWY": 10,
                             "^N225": 11, "^HSI": 12, "000001.SS": 13, "^STOXX50E": 14,
                             "^FTSE": 15, "^GDAXI": 16, "^FCHI": 17}
            rows = sorted(rows, key=lambda r: _FOREIGN_ORDER.get(r.symbol, 99))
            if rows:
                prev_close_map = {}
                current_date = rows[0].collected_date
                if current_date:
                    symbols = [r.symbol for r in rows if r.symbol]
                    for sym in symbols:
                        prev_row = (
                            db.query(models.YahooIndexDaily)
                            .filter(
                                models.YahooIndexDaily.group == "foreign",
                                models.YahooIndexDaily.symbol == sym,
                                models.YahooIndexDaily.date < current_date,
                                models.YahooIndexDaily.price.isnot(None),
                            )
                            .order_by(models.YahooIndexDaily.date.desc())
                            .first()
                        )
                        if prev_row and prev_row.price is not None:
                            prev_close_map[sym] = float(prev_row.price)
                results = []
                for r in rows:
                    if r.price is not None:
                        price = float(r.price)
                        prev_price = prev_close_map.get(r.symbol)
                        if prev_price is not None and prev_price != 0:
                            change_val = price - prev_price
                            pct_val = (change_val / prev_price) * 100
                        else:
                            change_val = float(r.change or 0.0)
                            pct_val = float(r.change_percent or 0.0)
                        results.append({
                            "symbol": r.symbol,
                            "name": r.name,
                            "market": r.market,
                            "price": round(price, 2),
                            "change": round(change_val, 2),
                            "change_percent": round(pct_val, 2),
                            "currency": r.currency or "USD",
                            "exchange": "",
                            "timestamp": None,
                        })
                if results:
                    r0 = rows[0]
                    c_date = r0.collected_date
                    c_time = r0.collected_time or "00:00"
                    base_timestamp = f"{c_date.strftime('%Y-%m-%d')} {c_time}"
                    return {
                        "success": True,
                        "data": results,
                        "count": len(results),
                        "base_timestamp": base_timestamp,
                    }
    except Exception as e:
        print(f"⚠️ foreign-indices DB 조회 실패: {e}")

    # 2) Fallback: Yahoo 실시간 조회
    cached = _get_cached("foreign-indices")
    if cached is not None:
        return cached

    # 주요 해외지수 심볼 - 미국지수(나스닥/S&P500/다우존스) 우선, 한국지수 포함
    indices = [
        {"symbol": "^IXIC", "name": "나스닥", "market": "US"},
        {"symbol": "^GSPC", "name": "S&P 500", "market": "US"},
        {"symbol": "^DJI", "name": "다우존스", "market": "US"},
        {"symbol": "^SOX", "name": "필라델피아 반도체", "market": "US"},
        {"symbol": "^KS11", "name": "코스피", "market": "KR"},
        {"symbol": "^KQ11", "name": "코스닥", "market": "KR"},
        {"symbol": "^KS200", "name": "코스피 200", "market": "KR"},
        {"symbol": "^MSKR", "name": "MSCI Korea", "market": "KR"},
        {"symbol": "EWY", "name": "iShares MSCI Korea ETF", "market": "US"},
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

                rm_price = meta.get("regularMarketPrice")
                baseline = (
                    meta.get("regularMarketPreviousClose")
                    or meta.get("previousClose")
                    or meta.get("chartPreviousClose")
                )
                if rm_price is not None and baseline is not None:
                    latest_price = float(rm_price)
                    prev_price = float(baseline)
                    change = latest_price - prev_price
                    change_percent = (change / prev_price * 100) if prev_price != 0 else 0
                    latest_idx = -1
                    return {
                        "symbol": index["symbol"],
                        "name": index["name"],
                        "market": index["market"],
                        "price": round(latest_price, 2),
                        "change": round(change, 2),
                        "change_percent": round(change_percent, 2),
                        "currency": meta.get("currency", "USD"),
                        "exchange": meta.get("exchangeName", ""),
                        "timestamp": meta.get("regularMarketTime") or (timestamps[-1] if timestamps else None),
                    }

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
# 아침 시장 요약 API (메인 레이어팝업용)
# =========================================================

@router.get("/api/market-morning-summary")
async def get_market_morning_summary(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    아침 시장 요약 - 뉴욕 마감, 나스닥 선물, 코스피200, 환율
    06:35 KST 스케줄러가 수집한 데이터 반환
    """
    from datetime import datetime as dt
    import pytz
    kst = pytz.timezone("Asia/Seoul")
    today = dt.now(kst).date()

    try:
        # YahooIndexDaily에서 group='morning' 오늘 데이터
        rows = db.query(models.YahooIndexDaily).filter(
            models.YahooIndexDaily.date == today,
            models.YahooIndexDaily.group == "morning",
        ).all()
        # 표시 순서: 미국지수 → 나스닥선물 → 코스피200 → 코스피200야간선물 → MSCI Korea → 한국지수
        _MORNING_ORDER = {"^IXIC": 0, "^GSPC": 1, "^DJI": 2, "^SOX": 3, "NQ=F": 4,
                          "^KS200": 5, "INV:8893": 6, "^MSKR": 7, "EWY": 8, "^KS11": 9, "^KQ11": 10}
        rows = sorted(rows, key=lambda r: _MORNING_ORDER.get(r.symbol, 99))

        indices = []
        for r in rows:
            if r.price is not None:
                chg = r.change or 0
                pct = r.change_percent or 0
                indices.append({
                    "name": r.name,
                    "symbol": r.symbol,
                    "price": round(r.price, 2),
                    "change": round(chg, 2),
                    "changePercent": round(pct, 2),
                    "isPositive": chg >= 0,
                })

        # 환율 (최신)
        latest_ex = db.query(func.max(models.ExchangeRateSnapshot.collected_at)).scalar()
        exchange_rates = []
        if latest_ex:
            ex_rows = db.query(models.ExchangeRateSnapshot).filter(
                models.ExchangeRateSnapshot.collected_at == latest_ex,
            ).all()
            currency_names = {"USD": "USD/KRW", "JPY": "JPY/KRW (100엔)", "EUR": "EUR/KRW"}
            for r in ex_rows:
                exchange_rates.append({
                    "currency": currency_names.get(r.currency, r.currency),
                    "rate": round(r.rate, 2),
                    "change": round(r.change_val, 2),
                    "isPositive": r.change_val >= 0,
                })

        # Gemini AI 요약
        ai_summary = None
        ai_row = db.query(models.MarketMorningAiSummary).filter(
            models.MarketMorningAiSummary.date == today,
        ).first()
        if ai_row:
            ai_summary = {
                "usMarket":        ai_row.us_market or "",
                "overnightIssues": ai_row.overnight_issues or "",
                "krIndices":       ai_row.kr_indices or "",
                "exchangeRate":    ai_row.exchange_rate or "",
                "todaySchedule":   ai_row.today_schedule or "",
                "krFocus":         ai_row.kr_focus or "",
            }

        morning_collected_time = rows[0].last_collected_time if rows else None
        return {
            "success": True,
            "data": {
                "indices": indices,
                "exchangeRates": exchange_rates,
                "collectedDate": today.isoformat(),
                "collectedTime": morning_collected_time,
                "aiSummary": ai_summary,
            },
        }
    except Exception as e:
        print(f"⚠️ market-morning-summary 조회 실패: {e}")
        return {"success": False, "data": {"indices": [], "exchangeRates": [], "collectedDate": None, "aiSummary": None}}


# =========================================================

@router.get("/api/exchange-rate")
async def get_exchange_rate(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key)
):
    """
    환율 조회 - DB에 저장된 최신 데이터 반환 (30분마다 수집)
    """
    try:
        latest = db.query(func.max(models.ExchangeRateSnapshot.collected_at)).scalar()
        if latest:
            rows = db.query(models.ExchangeRateSnapshot).filter(
                models.ExchangeRateSnapshot.collected_at == latest,
            ).all()
            if rows:
                r0 = rows[0]
                base_timestamp = f"{r0.collected_date.strftime('%Y-%m-%d')} {r0.collected_time}"
                currency_names = {"USD": "미국 USD", "JPY": "일본 JPY (100엔)", "EUR": "유럽 EUR"}
                results = []
                for r in rows:
                    rate_str = f"{r.rate:,.2f}"
                    change_str = f"+{r.change_val:.2f}" if r.change_val >= 0 else f"{r.change_val:.2f}"
                    results.append({
                        "currency": currency_names.get(r.currency, r.currency),
                        "rate": rate_str,
                        "change": change_str,
                        "isPositive": r.change_val >= 0,
                    })
                return {
                    "success": True,
                    "data": results,
                    "base_timestamp": base_timestamp,
                }
    except Exception as e:
        print(f"⚠️ exchange-rate DB 조회 실패: {e}")
    return {"success": False, "data": [], "base_timestamp": None}


# ── 금리 (Interest Rate) ───────────────────────────────────────────────────
_INTEREST_RATE_SYMBOLS = [
    {"symbol": "^TNX", "name": "미국 10년물", "unit": "%"},
    {"symbol": "^FVX", "name": "미국 5년물",  "unit": "%"},
    {"symbol": "^IRX", "name": "미국 단기",   "unit": "%"},
]
_INTEREST_RATE_CACHE_TTL = 3600  # 1시간


@router.get("/api/interest-rate")
async def get_interest_rate(
    authorized: bool = Depends(verify_api_key)
):
    """
    주요 금리 조회 - Yahoo Finance에서 on-demand 조회 (1시간 캐시)
    ^TNX: 미국 10년물 국채금리, ^FVX: 5년물, ^IRX: 단기(3개월)
    """
    cache_key = "interest-rate"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    results = []
    now_str = datetime.now(pytz.timezone("Asia/Seoul")).strftime("%Y-%m-%d %H:%M")

    async with httpx.AsyncClient(headers=_YAHOO_HEADERS, timeout=15.0) as client:
        for item in _INTEREST_RATE_SYMBOLS:
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{item['symbol']}?interval=1d&range=1d"
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                if not data or "chart" not in data or not data["chart"].get("result"):
                    continue
                meta = data["chart"]["result"][0].get("meta", {})
                price = meta.get("regularMarketPrice") or meta.get("chartPreviousClose")
                prev = meta.get("previousClose") or meta.get("chartPreviousClose") or price
                if price is None:
                    continue
                change_val = float(price) - float(prev) if prev else 0.0
                results.append({
                    "name": item["name"],
                    "rate": f"{float(price):.2f}{item['unit']}",
                    "change": f"+{change_val:.2f}" if change_val >= 0 else f"{change_val:.2f}",
                    "isPositive": change_val >= 0,
                })
            except Exception as e:
                print(f"⚠️ 금리 {item['symbol']} 조회 실패: {e}")

    if not results:
        return {"success": False, "data": [], "base_timestamp": None}

    response = {"success": True, "data": results, "base_timestamp": now_str}
    # 성공 시에만 캐시 (TTL을 직접 설정)
    _yahoo_cache[cache_key] = {"data": response, "expires": time.time() + _INTEREST_RATE_CACHE_TTL}
    return response


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
        
        # 쿼리 구성 (collected_at이 배치 식별자, max(collected_time) 문자열 비교 버그 회피)
        base_filter = [
            models.NaverStockRanking.ranking_type == ranking_type,
            models.NaverStockRanking.market_type == market_type,
        ]
        query = db.query(models.NaverStockRanking).filter(*base_filter)
        
        # 수집 시간대 필터 (지정된 경우)
        if collected_time:
            query = query.filter(models.NaverStockRanking.collected_time == collected_time)
        
        # 최신 수집 일시 기준 조회
        latest_date_filter = list(base_filter)
        if collected_time:
            latest_date_filter.append(models.NaverStockRanking.collected_time == collected_time)
        latest_date = db.query(func.max(models.NaverStockRanking.collected_at)).filter(*latest_date_filter).scalar()
        
        if latest_date:
            query = query.filter(models.NaverStockRanking.collected_at == latest_date)
        
        # 순위로 정렬
        query = query.order_by(models.NaverStockRanking.rank)
        
        # 제한
        rankings = query.limit(limit).all()
        
        latest_time = None
        if rankings and not collected_time:
            latest_time = rankings[0].collected_time
        
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


# ----------------------------------------------------------------
# 네이버 뉴스 주가 영향 뉴스 API
# ----------------------------------------------------------------

@router.get("/api/daily-issue-summary")
async def get_daily_issue_summary(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    금일 이슈 Gemini 요약 조회 (briefing 이슈 탭 상단용)
    08:40 / 12:40 / 19:40 스케줄러가 naver_stock_news 기반으로 생성 (뉴스 수집 10분 후)
    """
    try:
        today = datetime.now(pytz.timezone("Asia/Seoul")).date()
        rows = db.execute(text("""
            SELECT collected_time, summary FROM daily_issue_summaries
            WHERE date = :d ORDER BY collected_time
        """), {"d": today}).fetchall()
        if not rows:
            return {"success": True, "summary": None, "summaries": [], "date": today.isoformat()}
        summaries = [{"collected_time": r[0], "summary": r[1]} for r in rows]
        parts = []
        for r in rows:
            t, s = r[0], r[1]
            parts.append(f"[{t}]\n{s.strip()}" if t else s.strip())
        combined = "\n\n".join(parts)
        return {"success": True, "summary": combined, "summaries": summaries, "date": today.isoformat()}
    except Exception as e:
        return {"success": False, "summary": None, "summaries": [], "error": str(e)}


@router.post("/api/daily-issue-summary/generate")
async def trigger_daily_issue_summary(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    금일 이슈 Gemini 요약 수동 생성 (수동 트리거 / 검증용)
    naver_stock_news 기반으로 즉시 생성·저장
    """
    from app.services.daily_issue_gemini_service import generate_and_save_daily_issue_summary
    try:
        today = datetime.now(pytz.timezone("Asia/Seoul")).date()
        saved = generate_and_save_daily_issue_summary(db, today)
        if saved:
            row = db.execute(text("""
                SELECT summary FROM daily_issue_summaries WHERE date = :d
            """), {"d": today}).fetchone()
            summary = row[0] if row else None
            return {"success": True, "generated": True, "summary": summary, "date": today.isoformat()}
        else:
            return {"success": False, "generated": False, "message": "뉴스 없음 또는 Gemini 오류", "date": today.isoformat()}
    except Exception as e:
        return {"success": False, "generated": False, "error": str(e)}


@router.get("/api/naver-stock-news")
async def get_naver_stock_news(
    category: Optional[str] = Query(None, description="카테고리 필터 (수주/실적발표/배당/연구개발/기술이전/유상증자/무상증자/자사주매입/합병인수/특허/임상/적자전환/상장/분할)"),
    limit: int = Query(50, ge=1, le=200, description="최대 반환 건수"),
    offset: int = Query(0, ge=0, description="페이지 오프셋"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    수집된 주가 직접 영향 뉴스 조회

    - **category**: 카테고리로 필터링 (미입력 시 전체)
    - **limit**: 최대 반환 건수 (기본 50, 최대 200)
    - **offset**: 페이지네이션 오프셋

    카테고리 목록:
    수주, 실적발표, 배당, 연구개발, 기술이전, 유상증자, 무상증자,
    자사주매입, 합병인수, 특허, 임상, 적자전환, 상장, 분할
    """
    try:
        from app.services.naver_news_service import naver_news_service, STOCK_IMPACT_KEYWORDS

        news = naver_news_service.get_news_by_category(
            db=db,
            category=category,
            limit=limit,
            offset=offset,
        )

        total = db.query(models.NaverStockNews)
        if category:
            total = total.filter(models.NaverStockNews.category == category)
        total_count = total.count()

        return {
            "success": True,
            "category": category,
            "categories": list(STOCK_IMPACT_KEYWORDS.keys()),
            "data": news,
            "count": len(news),
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주가 영향 뉴스 조회 실패: {str(e)}")


@router.post("/api/market-closing-summary/generate")
async def trigger_market_closing_summary(
    target_date_str: Optional[str] = Query(None, description="대상 날짜 YYYY-MM-DD (미입력 시 오늘)"),
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    장마감 시황 수동 생성 (수동 트리거 / 검증용)
    - target_date: YYYY-MM-DD (미입력 시 오늘)
    - pending 상태로 B001에 게시 (기존 당일 게시글 있으면 덮어씀)
    """
    from datetime import date as dt_date
    import pytz
    from sqlalchemy import func as _func

    kst = pytz.timezone("Asia/Seoul")
    if target_date_str:
        try:
            target_date = dt_date.fromisoformat(target_date_str)
        except ValueError:
            return {"success": False, "error": f"날짜 형식 오류: {target_date_str} (YYYY-MM-DD)"}
    else:
        target_date = datetime.now(kst).date()

    bizdate = target_date.strftime("%Y%m%d")

    # 진단 정보 수집
    diag = {}
    try:
        kr_latest = (
            db.query(_func.max(models.YahooIndexDaily.date))
            .filter(models.YahooIndexDaily.group == "kr")
            .scalar()
        )
        diag["kr_latest_date"] = str(kr_latest) if kr_latest else None
        diag["target_date"] = str(target_date)

        supply_count = (
            db.query(models.NaverSupplyData)
            .filter(
                models.NaverSupplyData.data_type == "deal_rank",
                models.NaverSupplyData.bizdate == bizdate,
            )
            .count()
        )
        diag["supply_deal_rank_count"] = supply_count

        from app.config import GEMINI_API_KEY as _gkey
        diag["gemini_key_set"] = bool(_gkey)
    except Exception as e:
        diag["diag_error"] = str(e)

    # 실제 생성
    try:
        from app.services.market_closing_gemini_service import generate_and_post_closing_summary
        ok = generate_and_post_closing_summary(db, target_date)
        return {
            "success": ok,
            "generated": ok,
            "message": "장마감 시황 게시 완료 (pending)" if ok else "생성 실패 (KR지수 없음 또는 Gemini 오류)",
            "date": str(target_date),
            "diagnostics": diag,
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "generated": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "date": str(target_date),
            "diagnostics": diag,
        }


@router.post("/api/naver-stock-news/collect")
async def trigger_naver_stock_news_collect(
    categories: Optional[list] = None,
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_api_key),
):
    """
    주가 영향 뉴스 즉시 수집 (수동 트리거)

    - **categories**: 수집할 카테고리 목록 (미입력 시 전체)
    """
    try:
        from app.services.naver_news_service import naver_news_service

        news_list = await naver_news_service.fetch_stock_impact_news(categories=categories)
        saved = naver_news_service.save_news_to_db(db, news_list)

        return {
            "success": True,
            "fetched": len(news_list),
            "saved": saved,
            "message": f"뉴스 수집 완료: {len(news_list)}건 조회, {saved}건 신규 저장",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"뉴스 수집 실패: {str(e)}")


# =========================================================
# 투자자 심리지수 API
# =========================================================

@router.get("/api/sentiment/latest")
def get_sentiment_latest(
    db: Session = Depends(get_db),
    authorized=Depends(get_current_user_or_api_key_for_fsc),
):
    """최신 심리지수 스냅샷"""
    from app.engine.models import SentimentSnapshot
    row = db.query(SentimentSnapshot).order_by(SentimentSnapshot.created_at.desc()).first()
    if not row:
        return {"success": False, "message": "데이터 없음"}
    return {
        "success": True,
        "data": {
            "snapshot_date": row.snapshot_date,
            "snapshot_time": row.snapshot_time,
            "composite_score": row.composite_score,
            "label": row.label,
            "momentum_score": row.momentum_score,
            "vix_score": row.vix_score,
            "supply_score": row.supply_score,
            "volume_score": row.volume_score,
            "community_score": row.community_score,
            "news_score": row.news_score,
            "signal_score": row.signal_score,
            "ai_analysis": row.ai_analysis,
            "top_keywords": json.loads(row.top_keywords) if row.top_keywords else [],
        },
    }


@router.get("/api/sentiment/history")
def get_sentiment_history(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
    authorized=Depends(get_current_user_or_api_key_for_fsc),
):
    """최근 N일 일별 스냅샷 (날짜별 마지막 스냅샷)"""
    from app.engine.models import SentimentSnapshot
    from sqlalchemy import func as sa_func
    cutoff = (date.today() - __import__("datetime").timedelta(days=days)).strftime("%Y-%m-%d")

    # 날짜별 마지막 snapshot_time 기준
    sub = (
        db.query(
            SentimentSnapshot.snapshot_date,
            sa_func.max(SentimentSnapshot.snapshot_time).label("max_time"),
        )
        .filter(SentimentSnapshot.snapshot_date >= cutoff)
        .group_by(SentimentSnapshot.snapshot_date)
        .subquery()
    )

    rows = (
        db.query(SentimentSnapshot)
        .join(
            sub,
            (SentimentSnapshot.snapshot_date == sub.c.snapshot_date)
            & (SentimentSnapshot.snapshot_time == sub.c.max_time),
        )
        .order_by(SentimentSnapshot.snapshot_date.desc())
        .all()
    )

    return {
        "success": True,
        "data": [
            {
                "snapshot_date": r.snapshot_date,
                "snapshot_time": r.snapshot_time,
                "composite_score": r.composite_score,
                "label": r.label,
                "momentum_score": r.momentum_score,
                "vix_score": r.vix_score,
                "supply_score": r.supply_score,
                "volume_score": r.volume_score,
                "community_score": r.community_score,
                "news_score": r.news_score,
                "signal_score": r.signal_score,
            }
            for r in rows
        ],
    }


@router.post("/api/sentiment/run")
async def run_sentiment_manual(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """심리지수 수동 실행 (BO용, 백그라운드)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    async def _run():
        from app.database import SessionLocal
        from app.services.community_sentiment_service import collect_community_posts
        from app.services.sentiment_analysis_service import generate_sentiment_snapshot
        bg_db = SessionLocal()
        try:
            counts = await collect_community_posts(bg_db)
            print(f"[심리지수] 수동 수집: 네이버 {counts.get('naver', 0)}건, DC {counts.get('dc', 0)}건")
            snapshot = await generate_sentiment_snapshot(bg_db)
            if snapshot:
                print(f"[심리지수] 수동 스냅샷: {snapshot.composite_score}점 ({snapshot.label})")
        except Exception as e:
            print(f"[심리지수] 수동 실행 오류: {e}")
            import traceback
            traceback.print_exc()
        finally:
            bg_db.close()

    asyncio.create_task(_run())
    return {"success": True, "message": "심리지수 분석이 백그라운드에서 시작되었습니다."}