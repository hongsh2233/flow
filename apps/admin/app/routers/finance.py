"""
한국거래소(KRX) API 라우터

이 모듈은 한국거래소 데이터 조회 및 관리 페이지를 제공합니다.

주요 엔드포인트:
    - /admin/finance-data: 한국거래소 데이터 확인 페이지 (HTML)
    - /api/krx-market: 시장 현황 데이터 조회
    - /api/krx-kospi: 코스피 지수 데이터 조회
    - /api/krx-kosdaq: 코스닥 지수 데이터 조회
    - /api/krx-dates: KRX 데이터가 있는 날짜 목록 조회
    - /api/krx-data-by-date: 특정 날짜의 상세 데이터 조회
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.dependencies import get_current_user
from app.database import get_db
from app.config import ADMIN_EMAIL
from app.services.api_service import krx_api_service
from app.models import KrxData

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/api/krx-kospi")
async def get_krx_kospi(request: Request, bas_dd: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """한국거래소 코스피 지수 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    data = await krx_api_service.fetch_kospi_index(bas_dd, db)
    return JSONResponse(data)


@router.get("/api/krx-kosdaq")
async def get_krx_kosdaq(request: Request, bas_dd: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """한국거래소 코스닥 지수 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    data = await krx_api_service.fetch_kosdaq_index(bas_dd, db)
    return JSONResponse(data)


@router.get("/api/krx-market")
async def get_krx_market(request: Request, bas_dd: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """한국거래소 전체 시장 지수 조회 (코스피 + 코스닥)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    # 코스피와 코스닥 데이터를 모두 가져옴
    kospi_data = await krx_api_service.fetch_kospi_index(bas_dd, db)
    kosdaq_data = await krx_api_service.fetch_kosdaq_index(bas_dd, db)
    
    return JSONResponse({
        "kospi": kospi_data,
        "kosdaq": kosdaq_data
    })


@router.get("/api/krx-dates")
async def get_krx_dates(data_type: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """날짜별 목록 조회 (data_type: kospi, kosdaq, market)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    # market인 경우 모든 타입의 날짜 조회
    if data_type == "market":
        dates = db.query(distinct(KrxData.bas_dd)).order_by(KrxData.bas_dd.desc()).all()
    else:
        dates = db.query(distinct(KrxData.bas_dd)).filter(
            KrxData.data_type == data_type
        ).order_by(KrxData.bas_dd.desc()).all()

    date_list = [date[0] for date in dates]
    return JSONResponse({"dates": date_list})


@router.get("/api/krx-data-by-date")
async def get_krx_data_by_date(data_type: str, bas_dd: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """특정 날짜의 상세 데이터 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    if data_type == "market":
        # market인 경우 코스피와 코스닥 모두 조회
        kospi_data = await krx_api_service.fetch_kospi_index(bas_dd, db)
        kosdaq_data = await krx_api_service.fetch_kosdaq_index(bas_dd, db)
        return JSONResponse({
            "kospi": kospi_data,
            "kosdaq": kosdaq_data
        })
    elif data_type == "kospi":
        data = await krx_api_service.fetch_kospi_index(bas_dd, db)
        return JSONResponse(data)
    elif data_type == "kosdaq":
        data = await krx_api_service.fetch_kosdaq_index(bas_dd, db)
        return JSONResponse(data)
    else:
        return JSONResponse({"error": "잘못된 data_type입니다."}, status_code=400)
@router.get("/admin/finance-data", response_class=HTMLResponse)
async def finance_data_page(request: Request, user=Depends(get_current_user)):
    """한국거래소 데이터 확인 페이지"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("finance_data.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "active_page": "finance-data"
    })




@router.get("/api/naver-ranking-times")
async def get_naver_ranking_times(
    ranking_type: str,
    market_type: str = "all",
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """네이버 증권 랭킹 데이터의 수집 시간대 목록 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    from app.models import NaverStockRanking
    from sqlalchemy import func
    
    # 검색 상위는 시장 타입이 'all'만 가능
    if ranking_type == 'search' and market_type != 'all':
        market_type = 'all'
    
    # 수집 시간대 목록 조회
    times = db.query(
        NaverStockRanking.collected_time,
        func.max(NaverStockRanking.collected_at).label('latest_collected_at')
    ).filter(
        NaverStockRanking.ranking_type == ranking_type,
        NaverStockRanking.market_type == market_type,
    ).group_by(
        NaverStockRanking.collected_time
    ).order_by(
        func.max(NaverStockRanking.collected_at).desc()
    ).all()
    
    results = []
    for time, latest_date in times:
        results.append({
            "collected_time": time,
            "latest_collected_at": latest_date.isoformat() if latest_date else None,
        })
    
    return JSONResponse({
        "success": True,
        "data": results,
        "count": len(results),
    })


@router.get("/api/naver-ranking-data")
async def get_naver_ranking_data(
    ranking_type: str,
    market_type: str = "all",
    collected_time: str = None,
    limit: int = 50,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """네이버 증권 랭킹 데이터 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    from app.models import NaverStockRanking
    from sqlalchemy import func
    
    # 랭킹 타입 검증
    if ranking_type not in ['volume', 'amount', 'search']:
        return JSONResponse({"error": "랭킹 타입은 'volume', 'amount', 'search' 중 하나여야 합니다."}, status_code=400)
    
    # 시장 타입 검증
    if market_type not in ['kospi', 'kosdaq', 'all']:
        return JSONResponse({"error": "시장 타입은 'kospi', 'kosdaq', 'all' 중 하나여야 합니다."}, status_code=400)
    
    # 검색 상위는 시장 타입이 'all'만 가능
    if ranking_type == 'search' and market_type != 'all':
        market_type = 'all'
    
    # 쿼리 구성
    query = db.query(NaverStockRanking).filter(
        NaverStockRanking.ranking_type == ranking_type,
        NaverStockRanking.market_type == market_type,
    )
    
    # 수집 시간대 필터
    if collected_time:
        query = query.filter(NaverStockRanking.collected_time == collected_time)
    
    # 최신 데이터 조회 (수집 시간대가 지정되지 않은 경우)
    if not collected_time:
        # 가장 최근 수집 시간대 찾기
        latest_time = db.query(func.max(NaverStockRanking.collected_time)).filter(
            NaverStockRanking.ranking_type == ranking_type,
            NaverStockRanking.market_type == market_type,
        ).scalar()
        
        if latest_time:
            query = query.filter(NaverStockRanking.collected_time == latest_time)
    
    # 최신 수집 일시 기준으로 정렬
    latest_date = db.query(func.max(NaverStockRanking.collected_at)).filter(
        NaverStockRanking.ranking_type == ranking_type,
        NaverStockRanking.market_type == market_type,
    ).scalar()
    
    if latest_date:
        query = query.filter(NaverStockRanking.collected_at == latest_date)
    
    # 순위로 정렬
    query = query.order_by(NaverStockRanking.rank)
    
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
    
    return JSONResponse({
        "success": True,
        "data": results,
        "count": len(results),
        "ranking_type": ranking_type,
        "market_type": market_type,
        "collected_time": collected_time or latest_time,
    })


@router.post("/api/naver-ranking-manual-collect")
async def manual_collect_naver_ranking(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """네이버 증권 랭킹 데이터 수동 수집"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    try:
        from app.services.naver_finance_service import naver_finance_service
        from datetime import datetime
        import pytz
        
        kst = pytz.timezone('Asia/Seoul')
        now = datetime.now(kst)
        current_hour = now.hour
        
        # 수집 시간대 결정
        if current_hour == 11:
            collected_time = '11:00'
        elif current_hour == 16:
            collected_time = '16:00'
        elif current_hour == 21:
            collected_time = '21:00'
        else:
            collected_time = f"{current_hour:02d}:00"
        
        volume_count = 0
        amount_count = 0
        search_count = 0
        
        # 1. 거래량 상위 수집
        for market_type in ['kospi', 'kosdaq', 'all']:
            try:
                volume_data = await naver_finance_service.fetch_volume_ranking(
                    market_type=market_type,
                    limit=50
                )
                if volume_data:
                    naver_finance_service.save_ranking_to_db(
                        db=db,
                        ranking_type='volume',
                        market_type=market_type,
                        data=volume_data,
                        collected_time=collected_time
                    )
                    volume_count += len(volume_data)
            except Exception as e:
                print(f"⚠️ 거래량 상위 ({market_type}) 수집 오류: {e}")
        
        # 2. 거래대금 상위 수집
        for market_type in ['kospi', 'kosdaq', 'all']:
            try:
                amount_data = await naver_finance_service.fetch_amount_ranking(
                    market_type=market_type,
                    limit=50
                )
                if amount_data:
                    naver_finance_service.save_ranking_to_db(
                        db=db,
                        ranking_type='amount',
                        market_type=market_type,
                        data=amount_data,
                        collected_time=collected_time
                    )
                    amount_count += len(amount_data)
            except Exception as e:
                print(f"⚠️ 거래대금 상위 ({market_type}) 수집 오류: {e}")
        
        # 3. 검색 상위 수집
        try:
            search_data = await naver_finance_service.fetch_search_ranking(limit=50)
            if search_data:
                naver_finance_service.save_ranking_to_db(
                    db=db,
                    ranking_type='search',
                    market_type='all',
                    data=search_data,
                    collected_time=collected_time
                )
                search_count = len(search_data)
        except Exception as e:
            print(f"⚠️ 검색 상위 수집 오류: {e}")
        
        return JSONResponse({
            "success": True,
            "message": "데이터 수집이 완료되었습니다.",
            "collected_time": collected_time,
            "volume_count": volume_count,
            "amount_count": amount_count,
            "search_count": search_count,
        })
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 네이버 랭킹 데이터 수동 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        return JSONResponse({
            "success": False,
            "message": f"데이터 수집 중 오류가 발생했습니다: {str(e)}"
        }, status_code=500)



