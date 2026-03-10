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
from fastapi import APIRouter, Request, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.dependencies import get_current_user
from app.database import get_db
from typing import Optional
from app.services.api_service import krx_api_service
from app.models import KrxData
from datetime import date, timedelta

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
        "admin_email": user.email,
        "active_page": "finance-data"
    })


@router.get("/admin/yahoo-index", response_class=HTMLResponse)
async def yahoo_index_page(request: Request, user=Depends(get_current_user)):
    """야후 지수 데이터 확인 페이지"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("yahoo_index.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "yahoo-index"
    })


@router.get("/admin/naver-ranking", response_class=HTMLResponse)
async def naver_ranking_page(request: Request, user=Depends(get_current_user)):
    """네이버 증권 랭킹 데이터 확인 페이지"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("naver_ranking.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "naver-ranking"
    })


@router.get("/admin/stock-news", response_class=HTMLResponse)
async def stock_news_page(request: Request, user=Depends(get_current_user)):
    """재료(주가 영향 뉴스) 관리 페이지"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("admin_stock_news.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "stock-news"
    })


# =========================================================
# Yahoo Finance 지수 (DB 저장본 조회용 - Admin UI)
# =========================================================

@router.get("/api/yahoo-indices/latest")
async def get_yahoo_indices_latest(
    group: str = "kr",
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    저장된 Yahoo 지수의 "오늘(또는 최신 날짜)" 일별 최종값 조회
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    from app.models import YahooIndexDaily
    latest_date = db.query(func.max(YahooIndexDaily.date)).filter(YahooIndexDaily.group == group).scalar()
    if not latest_date:
        return JSONResponse({"success": True, "date": None, "data": []})

    rows = db.query(YahooIndexDaily).filter(
        YahooIndexDaily.group == group,
        YahooIndexDaily.date == latest_date,
    ).order_by(YahooIndexDaily.symbol.asc()).all()

    data = [{
        "date": r.date.isoformat(),
        "group": r.group,
        "symbol": r.symbol,
        "name": r.name,
        "market": r.market,
        "currency": r.currency,
        "price": r.price,
        "change": r.change,
        "change_percent": r.change_percent,
        "last_collected_at": r.last_collected_at.isoformat() if r.last_collected_at else None,
        "last_collected_time": r.last_collected_time,
    } for r in rows]

    return JSONResponse({"success": True, "date": latest_date.isoformat(), "data": data})


@router.get("/api/yahoo-indices/daily")
async def get_yahoo_indices_daily(
    group: str = "kr",
    days: int = 7,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    저장된 Yahoo 지수 일별 최종값을 최근 N일 조회 (기본 7일)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    from app.models import YahooIndexDaily
    days = max(1, min(days, 30))

    # latest date 기준으로 최근 N일 범위 계산
    latest_date = db.query(func.max(YahooIndexDaily.date)).filter(YahooIndexDaily.group == group).scalar()
    if not latest_date:
        return JSONResponse({"success": True, "data": []})

    start_date = latest_date - timedelta(days=days - 1)
    rows = db.query(YahooIndexDaily).filter(
        YahooIndexDaily.group == group,
        YahooIndexDaily.date >= start_date,
        YahooIndexDaily.date <= latest_date,
    ).order_by(YahooIndexDaily.date.desc(), YahooIndexDaily.symbol.asc()).all()

    data = [{
        "date": r.date.isoformat(),
        "group": r.group,
        "symbol": r.symbol,
        "name": r.name,
        "market": r.market,
        "currency": r.currency,
        "price": r.price,
        "change": r.change,
        "change_percent": r.change_percent,
        "last_collected_at": r.last_collected_at.isoformat() if r.last_collected_at else None,
        "last_collected_time": r.last_collected_time,
    } for r in rows]

    return JSONResponse({"success": True, "data": data, "latest_date": latest_date.isoformat()})


@router.post("/api/yahoo-indices/manual-collect")
async def manual_collect_yahoo_indices(
    group: str = "kr",
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    테스트용: Yahoo 지수 즉시 수동 수집 → DB 저장(스냅샷+일별 upsert) → 7일 유지 정리

    group:
    - kr: 코스피/코스닥
    - us: S&P500/다우/나스닥
    - all: kr+us

    한국지수(kr/all)는 주말·공휴일에는 수집하지 않습니다.
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    group = (group or "kr").lower().strip()
    if group not in ["kr", "us", "all"]:
        return JSONResponse({"error": "group은 kr|us|all 중 하나여야 합니다."}, status_code=400)

    from datetime import datetime
    import pytz
    from app.services.scheduler_service import should_skip_today

    kst = pytz.timezone("Asia/Seoul")
    now = datetime.now(kst)

    # 한국지수(kr, all)는 주말·공휴일 수집 건너뜀
    if group in ["kr", "all"] and should_skip_today():
        return JSONResponse({
            "success": False,
            "message": "한국 기준 주말 또는 공휴일에는 한국 지수 데이터를 수집하지 않습니다.",
        }, status_code=400)
    from app.services.yahoo_index_service import (
        fetch_indices,
        upsert_indices_to_db,
        DEFAULT_US_INDICES,
        DEFAULT_KR_INDICES,
    )

    try:
        # 너무 잦은 수동 수집 방지(레이트리밋 회피): 같은 그룹을 30초 내 재호출하면 차단
        from app.models import YahooIndexSnapshot
        recent = db.query(func.max(YahooIndexSnapshot.collected_at)).filter(
            YahooIndexSnapshot.group == ("kr" if group == "kr" else "us" if group == "us" else YahooIndexSnapshot.group)
        ).scalar()
        if recent and (now - recent).total_seconds() < 30:
            return JSONResponse(
                {"success": False, "message": "너무 자주 호출했습니다. 30초 후 다시 시도하세요."},
                status_code=429,
            )

        indices = []
        if group in ["kr", "all"]:
            indices.extend(DEFAULT_KR_INDICES)
        if group in ["us", "all"]:
            indices.extend(DEFAULT_US_INDICES)

        results = await fetch_indices(indices)
        upsert_indices_to_db(db, results, collected_at=now, keep_days=7)

        ok = [r for r in results if r.get("ok") is True]
        fail = [r for r in results if r.get("ok") is not True]

        return JSONResponse({
            "success": True,
            "group": group,
            "collected_at": now.isoformat(),
            "count_success": len(ok),
            "count_fail": len(fail),
            "failures": fail[:20],  # 너무 길어지는 것 방지
        })
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)




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
    base_filter = [
        NaverStockRanking.ranking_type == ranking_type,
        NaverStockRanking.market_type == market_type,
    ]
    query = db.query(NaverStockRanking).filter(*base_filter)
    
    # 수집 시간대 필터 (지정된 경우)
    if collected_time:
        query = query.filter(NaverStockRanking.collected_time == collected_time)
    
    # 최신 수집 일시 기준 조회 (collected_at이 배치 식별자, max(collected_time) 문자열 비교 버그 회피)
    latest_date_filter = base_filter.copy()
    if collected_time:
        latest_date_filter.append(NaverStockRanking.collected_time == collected_time)
    latest_date = db.query(func.max(NaverStockRanking.collected_at)).filter(*latest_date_filter).scalar()
    
    if latest_date:
        query = query.filter(NaverStockRanking.collected_at == latest_date)
    
    latest_time = None
    
    # 순위로 정렬
    query = query.order_by(NaverStockRanking.rank)
    
    # 제한
    rankings = query.limit(limit).all()
    
    # 응답용 collected_time (첫 행에서 추출)
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
    """네이버 증권 랭킹 데이터 수동 수집 - 한국 주말·공휴일에는 수집하지 않음"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    from app.services.scheduler_service import should_skip_today
    if should_skip_today():
        return JSONResponse({
            "success": False,
            "message": "한국 기준 주말 또는 공휴일에는 데이터 수집을 수행하지 않습니다.",
        }, status_code=400)

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


# =========================================================
# 재료(주가 영향 뉴스) API
# =========================================================

@router.get("/api/stock-news-list")
async def get_stock_news_list(
    category: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """재료 뉴스 목록 조회 (관리자용)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    from app.models import NaverStockNews
    q = db.query(NaverStockNews)
    if category:
        q = q.filter(NaverStockNews.category == category)
    total = q.count()
    rows = q.order_by(NaverStockNews.collected_at.desc(), NaverStockNews.id.desc()).offset(offset).limit(limit).all()
    data = [{
        "id": r.id,
        "category": r.category,
        "keyword": r.keyword,
        "title": r.title,
        "description": (r.description or "")[:200],
        "link": r.link,
        "pub_date": r.pub_date,
        "pub_datetime": r.pub_datetime.isoformat() if r.pub_datetime else None,
        "collected_at": r.collected_at.isoformat() if r.collected_at else None,
    } for r in rows]
    return JSONResponse({"success": True, "data": data, "total": total, "count": len(data)})


@router.post("/api/stock-news-manual-collect")
async def manual_collect_stock_news(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """재료 뉴스 수동 수집"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    try:
        from app.services.naver_news_service import naver_news_service
        news_list = await naver_news_service.fetch_stock_impact_news()
        saved = naver_news_service.save_news_to_db(db, news_list)
        naver_news_service.cleanup_old_news(db)
        return JSONResponse({
            "success": True,
            "fetched": len(news_list),
            "saved": saved,
            "message": f"뉴스 수집 완료: {len(news_list)}건 조회, {saved}건 신규 저장",
        })
    except Exception as e:
        import traceback
        print(f"❌ 재료 뉴스 수동 수집 오류: {e}\n{traceback.format_exc()}")
        return JSONResponse({
            "success": False,
            "message": f"뉴스 수집 실패: {str(e)}",
        }, status_code=500)


# =========================================================
# 네이버 수급 동향 API
# =========================================================

@router.get("/api/naver-supply/dates")
async def get_naver_supply_dates(
    data_type: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """수급 동향 데이터 보유 bizdate 목록 (최신순)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    from app.models import NaverSupplyData
    from sqlalchemy import text as sqla_text
    try:
        q = db.query(NaverSupplyData.bizdate).distinct()
        if data_type:
            q = q.filter(NaverSupplyData.data_type == data_type)
        dates = [r[0] for r in q.order_by(NaverSupplyData.bizdate.desc()).all()]
        return JSONResponse({"success": True, "data": dates})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


@router.get("/api/naver-supply/times")
async def get_naver_supply_times(
    data_type: str,
    market: str = "all",
    sub_key: str = None,
    bizdate: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """특정 data_type+bizdate의 수집 시간 목록"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    from app.models import NaverSupplyData
    try:
        q = db.query(NaverSupplyData.collected_time).filter(
            NaverSupplyData.data_type == data_type,
            NaverSupplyData.market == market,
        )
        if sub_key:
            q = q.filter(NaverSupplyData.sub_key == sub_key)
        if bizdate:
            q = q.filter(NaverSupplyData.bizdate == bizdate)
        times = [r[0] for r in q.distinct().order_by(NaverSupplyData.collected_time.desc()).all()]
        return JSONResponse({"success": True, "data": times})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


@router.get("/api/naver-supply/data")
async def get_naver_supply_data(
    data_type: str,
    market: str = "all",
    sub_key: str = None,
    bizdate: str = None,
    collected_time: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """수급 동향 데이터 조회 (최신 or 특정 날짜/시간)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    from app.models import NaverSupplyData
    from sqlalchemy import func as sa_func
    try:
        q = db.query(NaverSupplyData).filter(
            NaverSupplyData.data_type == data_type,
            NaverSupplyData.market == market,
        )
        if sub_key:
            q = q.filter(NaverSupplyData.sub_key == sub_key)
        elif sub_key is None and data_type != "deal_rank":
            q = q.filter(NaverSupplyData.sub_key.is_(None))
        if bizdate:
            q = q.filter(NaverSupplyData.bizdate == bizdate)
        if collected_time:
            q = q.filter(NaverSupplyData.collected_time == collected_time)

        row = q.order_by(NaverSupplyData.collected_at.desc()).first()
        if not row:
            return JSONResponse({"success": True, "data": None})

        import json as _json
        parsed = _json.loads(row.data_json) if row.data_json else {}
        return JSONResponse({
            "success": True,
            "data": parsed,
            "bizdate": row.bizdate,
            "collected_time": row.collected_time,
            "collected_at": row.collected_at.isoformat() if row.collected_at else None,
        })
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


@router.post("/api/naver-supply/manual-collect")
async def manual_collect_naver_supply(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    bizdate: Optional[str] = Query(
        default=None,
        description="수집 기준 거래일 (YYYYMMDD). 미입력 시 마지막 거래일 자동 사용.",
        pattern=r"^\d{8}$",
    ),
):
    """
    수급 동향 데이터 수동 수집.
    - bizdate 미입력: 마지막 거래일 자동 산출 (주말·연속 공휴일 상관없이 직전 거래일)
    - bizdate 직접 입력: 해당 날짜로 강제 수집 (예: ?bizdate=20260228)
    - collected_time은 실제 수집 시각 HH:MM 으로 저장 (String(5) 제약 준수)
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    try:
        import pytz
        from datetime import datetime as _dt
        from app.services.naver_supply_service import (
            collect_all_supply_data,
            get_last_trading_date,
        )
        target_date = bizdate if bizdate else get_last_trading_date()
        now_time = _dt.now(pytz.timezone("Asia/Seoul")).strftime("%H:%M")
        count = await collect_all_supply_data(db, bizdate=target_date, collected_time=now_time)
        return JSONResponse({
            "success": True,
            "count": count,
            "bizdate": target_date,
            "collected_time": now_time,
            "date_source": "입력값" if bizdate else "자동(마지막 거래일)",
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


@router.get("/api/naver-supply/debug-fetch")
async def debug_naver_supply_fetch(
    user=Depends(get_current_user),
    bizdate: str = Query(..., description="수집 기준 거래일 YYYYMMDD"),
    data_type: str = Query(default="investor_time", description="data_type (investor_time/investor_day/deal_rank/program_time/program_day)"),
):
    """
    수급 동향 단일 소스 디버그 수집.
    실제 Naver로 요청을 보내고 응답 HTML 앞부분 + 파싱 결과를 반환.
    """
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    import httpx
    from app.services.naver_supply_service import (
        BASE_URL, SUPPLY_SOURCES, _BASE_HEADERS, _REFERER, _parse_table
    )
    from bs4 import BeautifulSoup

    source = next((s for s in SUPPLY_SOURCES if s[0] == data_type), None)
    if not source:
        return JSONResponse({"error": f"알 수 없는 data_type: {data_type}"}, status_code=400)

    _, market, sub_key, url_path, url_params = source
    params = {
        k: (v.replace("{bizdate}", bizdate) if isinstance(v, str) else v)
        for k, v in url_params.items()
    }
    url = BASE_URL + url_path
    headers = {**_BASE_HEADERS, "Referer": _REFERER.get(data_type, "https://finance.naver.com/")}

    try:
        async with httpx.AsyncClient(headers=headers, timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, params=params)
        status = response.status_code
        try:
            content = response.content.decode("euc-kr", errors="replace")
        except Exception:
            content = response.text

        soup = BeautifulSoup(content, "html.parser")
        parsed = _parse_table(soup)

        return JSONResponse({
            "url": str(response.url),
            "status_code": status,
            "html_preview": content[:800],
            "parsed_headers": parsed.get("headers", []),
            "parsed_row_count": len(parsed.get("rows", [])),
            "parsed_rows_preview": parsed.get("rows", [])[:3],
        })
    except Exception as e:
        import traceback
        return JSONResponse({"error": str(e), "traceback": traceback.format_exc()}, status_code=500)


