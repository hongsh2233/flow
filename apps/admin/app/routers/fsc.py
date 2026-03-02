"""
금융위원회(FSC) API 라우터

이 모듈은 금융위원회 데이터 조회 및 관리 페이지를 제공합니다.

주요 엔드포인트:
    - /admin/finance-data2: 금융위원회 데이터 확인 페이지 (HTML)
    - /api/fsc-dates: FSC 데이터가 있는 날짜 목록 조회
    - /api/stock-price: 주식시세정보 조회 (시가총액 상위 200종목)
    - /api/disclosure-info: 공시정보 조회
    - /api/disclosure-info-by-date: 특정 날짜의 모든 공시정보 조회
"""
import time
from typing import Optional
from fastapi import APIRouter, Request, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import distinct, func

from app.dependencies import get_current_user, get_current_user_or_api_key_for_fsc
from app.database import get_db, SessionLocal
from app.config import ADMIN_EMAIL
from app.services.api_service import fsc_api_service
from app.services.scheduler_service import collect_fsc_data
from app.models import FscStockPrice, FscRisingStock

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/finance-data2", response_class=HTMLResponse)
async def finance_data2_page(request: Request, user=Depends(get_current_user)):
    """금융위원회 데이터 확인 페이지"""
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("finance_data2.html", {
        "request": request,
        "admin_email": ADMIN_EMAIL,
        "active_page": "finance-data2"
    })


@router.get("/api/fsc-dates")
async def get_fsc_dates(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """FSC 데이터가 있는 날짜 목록 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    try:
        dates = db.query(distinct(FscStockPrice.bas_dt)).order_by(FscStockPrice.bas_dt.desc()).all()
        date_list = [date[0] for date in dates]
        return JSONResponse({"dates": date_list})
    except Exception as e:
        print(f"❌ get_fsc_dates 오류: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/corp-outline")
async def get_corp_outline(
    corp_nm: Optional[str] = Query(None, alias="corpNm"),
    page_no: int = 1,
    num_of_rows: int = 50,
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """
    기업개요조회 - 금융위원회_기업기본정보 getCorpOutline_V2

    종목명(법인명)으로 기업기본정보를 조회합니다.
    쿠키(관리자) 또는 X-API-KEY(FE) 인증을 모두 허용합니다.
    """
    corp_nm = (corp_nm or "").strip()
    if not corp_nm:
        return JSONResponse(
            {"error": "corpNm(법인명)을 입력해 주세요.", "data": []},
            status_code=400,
        )
    try:
        items, total_count = await fsc_api_service.fetch_corp_outline(
            corp_nm=corp_nm, page_no=page_no, num_of_rows=num_of_rows
        )
        items = items or []
        return JSONResponse(
            {
                "data": items,
                "total_count": total_count or 0,
                "count": len(items),
            }
        )
    except Exception as e:
        import traceback

        print(f"❌ get_corp_outline 오류: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": str(e), "data": []}, status_code=500)


@router.get("/api/stock-price")
async def get_stock_price(
    request: Request, 
    page_no: int = 1, 
    num_of_rows: int = 200, 
    bas_dt: str = None, 
    mrkt_ctg: str = None,
    min_flt_rt: Optional[float] = None,
    max_flt_rt: Optional[float] = None,
    order_by: Optional[str] = None,
    order_direction: Optional[str] = None,
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """금융위원회 주식시세정보 조회 (시가총액 상위 200종목 또는 상승종목)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    try:
        # DB에서 데이터 조회
        query = db.query(FscStockPrice)
        
        # 날짜 필터링
        if bas_dt:
            query = query.filter(FscStockPrice.bas_dt == bas_dt)
        else:
            # 최신 날짜 조회
            latest_date_result = db.query(
                func.max(FscStockPrice.bas_dt)
            ).scalar()
            if latest_date_result:
                query = query.filter(FscStockPrice.bas_dt == latest_date_result)
                bas_dt = latest_date_result
            else:
                return JSONResponse({
                    "success": False,
                    "error": "데이터를 찾을 수 없습니다.",
                    "data": []
                }, status_code=404)
        
        # 시장구분 필터링
        if mrkt_ctg:
            query = query.filter(FscStockPrice.mrkt_ctg == mrkt_ctg)
        
        # 모든 데이터 가져오기
        all_stocks = query.all()
        
        # 등락률 필터링 (Python에서 처리)
        filtered_stocks = []
        for stock in all_stocks:
            if stock.flt_rt:
                # 등락률 문자열 파싱
                flt_rt_str = str(stock.flt_rt).replace('%', '').replace(' ', '').strip()
                is_negative = flt_rt_str.startswith('-')
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
        reverse_order = order_direction != "asc" if order_direction else True
        
        if order_by == "flt_rt":
            # 등락률 정렬
            sorted_stocks = sorted(
                filtered_stocks,
                key=lambda x: float(str(x.flt_rt or '0').replace('%', '').replace('+', '').replace('-', '').replace(' ', '').strip() or 0) if x.flt_rt else 0,
                reverse=reverse_order
            )[:num_of_rows]
        else:
            # 시가총액 정렬 (기본값)
            sorted_stocks = sorted(
                filtered_stocks,
                key=lambda x: float(str(x.mrkt_tot_amt or '0').replace(',', '').replace(' ', '') or 0),
                reverse=reverse_order
            )[:num_of_rows]
        
        # 결과 변환
        result = []
        for stock in sorted_stocks:
            result.append({
                "basDt": stock.bas_dt,
                "srtnCd": stock.srtn_cd,
                "isinCd": stock.isin_cd,
                "itmsNm": stock.itms_nm,
                "mrktCtg": stock.mrkt_ctg,
                "clpr": stock.clpr,
                "vs": stock.vs,
                "fltRt": stock.flt_rt,
                "mkp": stock.mkp,
                "hipr": stock.hipr,
                "lopr": stock.lopr,
                "trqu": stock.trqu,
                "trPrc": stock.tr_prc,
                "lstgStCnt": stock.lstg_st_cnt,
                "mrktTotAmt": stock.mrkt_tot_amt
            })
        
        return JSONResponse({
            "success": True,
            "data": result,
            "bas_dt": bas_dt,
            "count": len(result)
        })
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ get_stock_price 오류: {str(e)}")
        print(f"❌ 상세 오류:\n{error_detail}")
        return JSONResponse({
            "success": False,
            "error": str(e),
            "data": []
        }, status_code=500)


@router.get("/api/fsc-rising-dates")
async def get_fsc_rising_dates(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """상승종목 데이터가 있는 날짜 목록 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    try:
        dates = db.query(distinct(FscRisingStock.bas_dt)).order_by(FscRisingStock.bas_dt.desc()).all()
        date_list = [date[0] for date in dates]
        return JSONResponse({"dates": date_list})
    except Exception as e:
        print(f"❌ get_fsc_rising_dates 오류: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/rising-stock-price")
async def get_rising_stock_price(
    request: Request,
    page_no: int = 1,
    num_of_rows: int = 1000,
    bas_dt: str = None,
    mrkt_ctg: str = None,
    min_flt_rt: Optional[float] = None,
    order_by: Optional[str] = None,
    order_direction: Optional[str] = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """상승종목 조회 (별도 테이블에서 조회)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    try:
        query = db.query(FscRisingStock)

        # 날짜 필터링
        if bas_dt:
            query = query.filter(FscRisingStock.bas_dt == bas_dt)
        else:
            latest_date_result = db.query(func.max(FscRisingStock.bas_dt)).scalar()
            if latest_date_result:
                query = query.filter(FscRisingStock.bas_dt == latest_date_result)
                bas_dt = latest_date_result
            else:
                return JSONResponse({
                    "success": False,
                    "error": "상승종목 데이터를 찾을 수 없습니다.",
                    "data": []
                }, status_code=404)

        # 시장구분 필터링
        if mrkt_ctg:
            query = query.filter(FscRisingStock.mrkt_ctg == mrkt_ctg)

        all_stocks = query.all()

        # 등락률 필터링
        filtered_stocks = []
        for stock in all_stocks:
            if min_flt_rt is not None and stock.flt_rt:
                flt_rt_str = str(stock.flt_rt).replace('%', '').replace(' ', '').strip()
                is_negative = flt_rt_str.startswith('-')
                flt_rt_clean = flt_rt_str.replace('+', '').replace('-', '').strip()
                try:
                    flt_rt_value = float(flt_rt_clean) if flt_rt_clean else 0.0
                    if is_negative:
                        flt_rt_value = -flt_rt_value
                except (ValueError, TypeError):
                    flt_rt_value = 0.0
                if flt_rt_value < min_flt_rt:
                    continue
            filtered_stocks.append(stock)

        # 정렬 (기본: 등락률 내림차순)
        reverse_order = order_direction != "asc" if order_direction else True
        sorted_stocks = sorted(
            filtered_stocks,
            key=lambda x: float(str(x.flt_rt or '0').replace('%', '').replace('+', '').replace('-', '').replace(' ', '').strip() or 0) if x.flt_rt else 0,
            reverse=reverse_order
        )[:num_of_rows]

        # 결과 변환
        result = []
        for stock in sorted_stocks:
            result.append({
                "basDt": stock.bas_dt,
                "srtnCd": stock.srtn_cd,
                "isinCd": stock.isin_cd,
                "itmsNm": stock.itms_nm,
                "mrktCtg": stock.mrkt_ctg,
                "clpr": stock.clpr,
                "vs": stock.vs,
                "fltRt": stock.flt_rt,
                "mkp": stock.mkp,
                "hipr": stock.hipr,
                "lopr": stock.lopr,
                "trqu": stock.trqu,
                "trPrc": stock.tr_prc,
                "lstgStCnt": stock.lstg_st_cnt,
                "mrktTotAmt": stock.mrkt_tot_amt
            })

        return JSONResponse({
            "success": True,
            "data": result,
            "bas_dt": bas_dt,
            "count": len(result)
        })
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ get_rising_stock_price 오류: {str(e)}")
        print(f"❌ 상세 오류:\n{error_detail}")
        return JSONResponse({
            "success": False,
            "error": str(e),
            "data": []
        }, status_code=500)


@router.get("/api/disclosure-info")
async def get_disclosure_info(request: Request, disclosure_type: str, bas_dt: str = None, user=Depends(get_current_user)):
    """공시정보 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    try:
        data, actual_date = await fsc_api_service.fetch_disclosure_info(
            disclosure_type=disclosure_type,
            page_no=1,
            num_of_rows=1000,
            bas_dt=bas_dt
        )
        
        if not data or len(data) == 0:
            return JSONResponse({"error": "데이터를 찾을 수 없습니다."}, status_code=404)
        
        return JSONResponse({
            "data": data,
            "bas_dt": actual_date,
            "disclosure_type": disclosure_type
        })
    except Exception as e:
        print(f"❌ get_disclosure_info 오류: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/disclosure-info-by-date")
async def get_disclosure_info_by_date(request: Request, bas_dt: str, user=Depends(get_current_user)):
    """특정 날짜의 모든 공시정보 조회"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    try:
        # 모든 공시정보 타입 조회
        disclosure_types = ["dividend", "paid_increase", "bonus", "paid_bonus", "shareholders"]
        all_data = {}

        for disc_type in disclosure_types:
            data, actual_date = await fsc_api_service.fetch_disclosure_info(
                disclosure_type=disc_type,
                page_no=1,
                num_of_rows=1000,
                bas_dt=bas_dt
            )

            # 데이터가 있으면 저장 (필터링 없이, API가 이미 해당 날짜의 데이터를 반환함)
            if data and len(data) > 0:
                # basDt 필드가 여러 형태일 수 있으므로 확인
                # 실제 날짜와 일치하는 데이터만 필터링
                filtered_data = []
                for item in data:
                    item_date = item.get('basDt') or item.get('BAS_DT') or item.get('bas_dt') or actual_date
                    if item_date == bas_dt or actual_date == bas_dt:
                        filtered_data.append(item)

                if filtered_data:
                    all_data[disc_type] = filtered_data
                    print(f"✅ {disc_type}: {len(filtered_data)}건 저장")

        print(f"📊 총 {len(all_data)}개 타입의 공시정보 수집 완료")
        return JSONResponse({
            "data": all_data,
            "bas_dt": bas_dt
        })
    except Exception as e:
        import traceback
        print(f"❌ get_disclosure_info_by_date 오류: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/right-schedule")
async def get_right_schedule(
    request: Request,
    bas_dt: str = None,
    issu_cmpy_ksd_cust_no: str = None,
    stck_issu_cmpy_nm: str = None,
    crno: str = None,
    page_no: int = 1,
    num_of_rows: int = 1000,
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """권리행사사유별일정조회 (API-OA-20.1) - 회사명 또는 법인등록번호로 검색, 전체 호출 후 최신일 기준 20건만 반환. 쿠키(관리자) 또는 X-API-KEY(FE) 인증."""
    if not stck_issu_cmpy_nm and not crno:
        return JSONResponse({"error": "주식발행회사명 또는 법인등록번호를 입력해 주세요."}, status_code=400)

    # bas_dt 없이 호출: API가 가진 데이터를 받은 뒤, 응답 내 최신일만 필터 (오늘만 요청하면 데이터 없을 때 빈 결과)
    try:
        # 법인등록번호 검색 시 회사명 없이; 회사명 검색 시 회사명으로 호출. 날짜는 넘기지 않음.
        data, total_count = await fsc_api_service.fetch_righ_exer_reas_sche(
            bas_dt=bas_dt or None,
            issu_cmpy_ksd_cust_no=issu_cmpy_ksd_cust_no or None,
            stck_issu_cmpy_nm=stck_issu_cmpy_nm or None,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
        if not data:
            return JSONResponse({"data": [], "total_count": total_count or 0, "count": 0, "latest_bas_dt": None})

        # 법인등록번호로 검색한 경우 응답에서 crno 일치하는 항목만 필터
        if crno:
            crno_str = str(crno).strip()
            data = [item for item in data if str(item.get("crno") or "").strip() == crno_str]
            if not data:
                return JSONResponse({"data": [], "total_count": 0, "count": 0, "latest_bas_dt": None})

        # 최신일(basDt) 기준 필터: 최신일만 남기고 20건만
        bas_dts = [str(item.get("basDt") or "").strip() for item in data if item.get("basDt")]
        latest_bas_dt = max(bas_dts) if bas_dts else None
        if latest_bas_dt:
            data = [item for item in data if str(item.get("basDt") or "").strip() == latest_bas_dt]
        data = data[:20]

        return JSONResponse({
            "data": data,
            "total_count": total_count,
            "count": len(data),
            "latest_bas_dt": latest_bas_dt,
        })
    except Exception as e:
        import traceback
        print(f"❌ get_right_schedule 오류: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/divi-info")
async def get_divi_info(
    bas_dt: Optional[str] = None,
    crno: Optional[str] = None,
    stck_issu_cmpy_nm: Optional[str] = None,
    page_no: int = 1,
    num_of_rows: int = 100,
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """주식배당정보 조회 (GetStocDiviInfoService getDiviInfo) - 기준일자, 법인등록번호, 주식발행회사명으로 배당정보 조회"""
    if not stck_issu_cmpy_nm and not crno:
        return JSONResponse({"error": "주식발행회사명 또는 법인등록번호를 입력해 주세요."}, status_code=400)
    try:
        data, total_count = await fsc_api_service.fetch_divi_info(
            bas_dt=bas_dt or None,
            crno=crno or None,
            stck_issu_cmpy_nm=stck_issu_cmpy_nm or None,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
        return JSONResponse({
            "data": data,
            "total_count": total_count or 0,
            "count": len(data),
        })
    except Exception as e:
        import traceback
        print(f"❌ get_divi_info 오류: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


# 재무제표 조회 캐시: (crno, biz_year, types_key) -> (expiry_ts, response_dict), TTL 10분
_FINA_STAT_CACHE: dict[tuple[str, str, str], tuple[float, dict]] = {}
_FINA_STAT_CACHE_TTL = 600


@router.get("/api/fina-stat")
async def get_fina_stat(
    request: Request,
    crno: str = None,
    biz_year: str = None,
    types: str = None,  # comma: summ,bs,inco
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """GetFinaStatInfoService_V2: 요약재무제표/재무상태표/손익계산서. types=summ,bs,inco 중 선택(쉼표 구분)."""
    crno = (crno or "").strip()
    biz_year = (biz_year or "").strip()
    type_list = [t.strip().lower() for t in (types or "").split(",") if t.strip()]
    allowed = {"summ", "bs", "inco"}
    type_list = [t for t in type_list if t in allowed]
    if not crno or not biz_year or not type_list:
        return JSONResponse(
            {"error": "법인등록번호(crno), 사업연도(biz_year), 조회항목(types=summ,bs,inco 중 하나 이상)을 입력해 주세요."},
            status_code=400,
        )
    cache_key = (crno, biz_year, ",".join(sorted(type_list)))
    now = time.time()
    if cache_key in _FINA_STAT_CACHE:
        expiry_ts, cached = _FINA_STAT_CACHE[cache_key]
        if now < expiry_ts:
            return JSONResponse(cached)
    for k in list(_FINA_STAT_CACHE.keys()):
        if _FINA_STAT_CACHE[k][0] <= now:
            del _FINA_STAT_CACHE[k]
    try:
        result = {}
        if "summ" in type_list:
            data, total = await fsc_api_service.fetch_summ_fina_stat_v2(crno, biz_year)
            result["summ"] = {"data": data, "total_count": total, "count": len(data)}
        if "bs" in type_list:
            data, total = await fsc_api_service.fetch_bs_v2(crno, biz_year)
            result["bs"] = {"data": data, "total_count": total, "count": len(data)}
        if "inco" in type_list:
            data, total = await fsc_api_service.fetch_inco_stat_v2(crno, biz_year)
            result["inco"] = {"data": data, "total_count": total, "count": len(data)}
        payload = {"crno": crno, "biz_year": biz_year, "result": result}
        _FINA_STAT_CACHE[cache_key] = (now + _FINA_STAT_CACHE_TTL, payload)
        return JSONResponse(payload)
    except Exception as e:
        import traceback
        print(f"❌ get_fina_stat 오류: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/api/fsc-collect-manual")
async def manual_collect_fsc_data(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """FSC 데이터 수동 수집 (관리자 전용) - 한국 주말·공휴일에는 수집하지 않음"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    from app.services.scheduler_service import should_skip_today
    if should_skip_today():
        return JSONResponse({
            "success": False,
            "error": "한국 기준 주말 또는 공휴일에는 데이터 수집을 수행하지 않습니다.",
        }, status_code=400)

    try:
        print(f"\n{'='*60}")
        print(f"📊 FSC 데이터 수동 수집 시작")
        print(f"{'='*60}")
        
        # 최신 데이터 수집 (bas_dt=None으로 호출하면 API가 자동으로 최신 데이터를 찾음)
        print("🔄 금융위원회 API 호출 중... (최신 데이터 확인)")
        data, actual_date = await fsc_api_service.fetch_stock_price_info(
            page_no=1,
            num_of_rows=200,
            bas_dt=None,  # None으로 호출하면 최신 데이터 자동 조회
            db=db
        )
        
        if data and len(data) > 0 and actual_date:
            print(f"✅ 최신 데이터 수집 완료: {actual_date} ({len(data)}건)")
            
            # 3일치 데이터만 유지
            from app.services.scheduler_service import cleanup_old_fsc_data
            cleanup_old_fsc_data(db, keep_days=3)
            
            print(f"{'='*60}")
            print(f"✅ FSC 데이터 수동 수집 완료")
            print(f"{'='*60}\n")
            
            return JSONResponse({
                "success": True,
                "message": f"FSC 데이터 수집이 완료되었습니다. ({actual_date}, {len(data)}건)"
            })
        else:
            print(f"⚠️ 수집된 데이터가 없습니다.")
            print(f"{'='*60}\n")
            return JSONResponse({
                "success": False,
                "error": "수집된 데이터가 없습니다."
            }, status_code=404)
            
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 수동 데이터 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@router.post("/api/fsc-collect-rising-stocks")
async def collect_rising_stocks(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """상승종목 수동 수집 (관리자 전용) - 한국 주말·공휴일에는 수집하지 않음"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)

    from app.services.scheduler_service import should_skip_today
    if should_skip_today():
        return JSONResponse({
            "success": False,
            "error": "한국 기준 주말 또는 공휴일에는 데이터 수집을 수행하지 않습니다.",
        }, status_code=400)

    try:
        # 기본값으로 수집 (최신 데이터, 10% 이상 상승, 최대 1000개)
        data, actual_date = await fsc_api_service.fetch_rising_stocks(
            bas_dt=None,
            db=db,
            min_flt_rt=10.0,  # 10% 이상 상승 종목만
            limit=1000
        )
        
        if data and len(data) > 0 and actual_date:
            # fetch_rising_stocks()가 이미 별도 테이블(fsc_rising_stock)에 저장했으므로
            # 추가 저장 불필요

            return JSONResponse({
                "success": True,
                "message": f"상승종목 수집이 완료되었습니다. ({actual_date}, {len(data)}건)",
                "bas_dt": actual_date,
                "count": len(data)
            })
        else:
            return JSONResponse({
                "success": False,
                "error": "수집된 데이터가 없습니다."
            }, status_code=404)
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 상승종목 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@router.post("/api/fsc-delete-all-data")
async def delete_all_fsc_data(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """FSC 데이터 전체 삭제 (관리자 전용)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    try:
        # 모든 FSC 데이터 삭제 (시가총액 + 상승종목)
        deleted_mktcap = db.query(FscStockPrice).delete()
        deleted_rising = db.query(FscRisingStock).delete()
        db.commit()

        total_deleted = deleted_mktcap + deleted_rising
        return JSONResponse({
            "success": True,
            "message": f"모든 FSC 데이터가 삭제되었습니다. (시가총액 {deleted_mktcap}건 + 상승종목 {deleted_rising}건 = 총 {total_deleted}건)",
            "deleted_count": total_deleted
        })
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ FSC 데이터 삭제 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        db.rollback()
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@router.post("/api/fsc-collect-past-days")
async def collect_past_days(
    days: int = 30,
    collect_type: str = "mktcap",  # "mktcap" 또는 "rising"
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과거 1일부터 N일까지 데이터 수집 (관리자 전용)"""
    if not user:
        return JSONResponse({"error": "인증이 필요합니다."}, status_code=401)
    
    if days < 1 or days > 30:
        return JSONResponse({
            "success": False,
            "error": "1일부터 30일까지만 수집할 수 있습니다."
        }, status_code=400)
    
    try:
        from datetime import datetime, timedelta
        
        collected_dates = []
        failed_dates = []
        
        # 오늘부터 역순으로 과거 데이터 수집
        today = datetime.now()
        
        for day_offset in range(1, days + 1):
            target_date = today - timedelta(days=day_offset)
            date_str = target_date.strftime("%Y%m%d")
            
            try:
                if collect_type == "rising":
                    # 상승종목 수집
                    data, actual_date = await fsc_api_service.fetch_rising_stocks(
                        bas_dt=date_str,
                        db=db,
                        min_flt_rt=0.01,
                        limit=1000
                    )
                else:
                    # 시가총액 상위 200개 수집
                    data, actual_date = await fsc_api_service.fetch_stock_price_info(
                        page_no=1,
                        num_of_rows=200,
                        bas_dt=date_str,
                        db=db
                    )
                
                if data and len(data) > 0:
                    collected_dates.append(actual_date or date_str)
                    print(f"✅ {date_str} 데이터 수집 완료 ({len(data)}건)")
                else:
                    failed_dates.append(date_str)
                    print(f"⚠️ {date_str} 데이터 없음")
            except Exception as e:
                failed_dates.append(date_str)
                print(f"❌ {date_str} 수집 실패: {str(e)}")
        
        return JSONResponse({
            "success": True,
            "message": f"과거 {days}일 데이터 수집 완료: {len(collected_dates)}일 성공, {len(failed_dates)}일 실패",
            "collected_dates": collected_dates,
            "failed_dates": failed_dates,
            "total_collected": len(collected_dates),
            "total_failed": len(failed_dates)
        })
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 과거 데이터 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


# ==================== 대차거래 (GetCMStckLnbInfoService) ====================

@router.get("/api/stck-lnb-detail")
async def get_stck_lnb_detail(
    request: Request,
    bas_dt: str = None,
    isin_cd: str = None,
    itms_nm: str = None,
    page_no: int = 1,
    num_of_rows: int = 100,
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """주식 대차거래내역 조회 (getStckLnbDetail)"""
    try:
        data, total_count = await fsc_api_service.fetch_stck_lnb_detail(
            bas_dt=bas_dt or None,
            isin_cd=isin_cd or None,
            itms_nm=itms_nm or None,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
        return JSONResponse({
            "data": data,
            "total_count": total_count,
            "count": len(data),
        })
    except Exception as e:
        import traceback
        print(f"❌ get_stck_lnb_detail 오류: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/stck-lnb-progress")
async def get_stck_lnb_progress(
    request: Request,
    bas_dt: str = None,
    isin_cd: str = None,
    itms_nm: str = None,
    page_no: int = 1,
    num_of_rows: int = 100,
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """주식 대차거래추이 조회 (getStckLnbProgress)"""
    try:
        data, total_count = await fsc_api_service.fetch_stck_lnb_progress(
            bas_dt=bas_dt or None,
            isin_cd=isin_cd or None,
            itms_nm=itms_nm or None,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
        return JSONResponse({
            "data": data,
            "total_count": total_count,
            "count": len(data),
        })
    except Exception as e:
        import traceback
        print(f"❌ get_stck_lnb_progress 오류: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/stck-lnb-invpn-detail")
async def get_stck_lnb_invpn_detail(
    request: Request,
    bas_dt: str = None,
    isin_cd: str = None,
    itms_nm: str = None,
    page_no: int = 1,
    num_of_rows: int = 100,
    auth=Depends(get_current_user_or_api_key_for_fsc),
):
    """참여자별주식대차거래내역 조회 (getStckLnbInvpnDetail)"""
    try:
        data, total_count = await fsc_api_service.fetch_stck_lnb_invpn_detail(
            bas_dt=bas_dt or None,
            isin_cd=isin_cd or None,
            itms_nm=itms_nm or None,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
        return JSONResponse({
            "data": data,
            "total_count": total_count,
            "count": len(data),
        })
    except Exception as e:
        import traceback
        print(f"❌ get_stck_lnb_invpn_detail 오류: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)

