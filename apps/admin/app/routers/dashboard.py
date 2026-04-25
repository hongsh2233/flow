"""
대시보드 라우터
"""
import asyncio
import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from datetime import datetime, timedelta
import pytz

from app.dependencies import get_current_user
from app.database import get_db
from app import models
from app import config
from app.services.kiwoom_service import (
    get_kiwoom_service,
    normalize_stk_cd,
    KiwoomApiError,
    rank_rows_from_response,
    kiwoom_column_label_ko,
    kiwoom_quotes_td_class,
)
from app.services.kiwoom_mock_trading_service import get_mock_trading_service
from app.services.kiwoom_auto_trading_service import (
    AutoStrategySpec,
    get_auto_trading_service,
)
from app.services.kiwoom_multi_screening_service import run_kiwoom_screening

router = APIRouter()


def _kiwoom_screening_ko_strings() -> dict[str, Any]:
    p = (
        Path(__file__).resolve().parent.parent.parent
        / "dashboard"
        / "templates"
        / "kiwoom_screening_strings.json"
    )
    return json.loads(p.read_text(encoding="utf-8"))
templates = Jinja2Templates(directory="dashboard/templates")
templates.env.globals["kiwoom_col_ko"] = kiwoom_column_label_ko
templates.env.globals["kiwoom_td_class"] = kiwoom_quotes_td_class


@router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """관리자 대시보드"""
    if not user:
        return RedirectResponse(url="/")
    
    # 통계 데이터 수집
    stats = {}
    
    # 게시판 통계
    stats['total_boards'] = db.query(models.Board).count()
    stats['total_posts'] = db.query(models.Post).count()
    total_views_result = db.query(func.sum(models.Post.views)).scalar()
    stats['total_views'] = int(total_views_result) if total_views_result else 0
    
    # 회원 통계
    stats['total_members'] = db.query(models.Member).count()
    stats['active_members'] = db.query(models.Member).filter(models.Member.status == 'active').count()
    
    # 일정 통계
    stats['total_schedules'] = db.query(models.Schedule).count()
    _kst = pytz.timezone("Asia/Seoul")
    _now_kst = datetime.now(_kst)
    today = _now_kst.date()
    stats['upcoming_schedules'] = db.query(models.Schedule).filter(models.Schedule.date >= today).count()

    # 관리자 통계
    stats['total_admins'] = db.query(models.AdminUser).count()

    # 금융 데이터 통계
    stats['krx_data_count'] = db.query(models.KrxData).count()
    stats['fsc_data_count'] = db.query(models.FscStockPrice).count()

    # 최근 7일간 게시글 작성 통계 (그래프용)
    seven_days_ago = _now_kst - timedelta(days=7)
    recent_posts = db.query(
        func.date(models.Post.created_at).label('date'),
        func.count(models.Post.id).label('count')
    ).filter(
        models.Post.created_at >= seven_days_ago
    ).group_by(func.date(models.Post.created_at)).all()
    
    post_stats = []
    for i in range(7):
        date = (_now_kst - timedelta(days=6-i)).date()
        count = next((p.count for p in recent_posts if p.date == date), 0)
        post_stats.append({
            'date': date.strftime('%m/%d'),
            'count': count
        })
    
    # 최근 7일간 조회수 통계
    recent_views = db.query(
        func.date(models.Post.updated_at).label('date'),
        func.sum(models.Post.views).label('total_views')
    ).filter(
        models.Post.updated_at >= seven_days_ago
    ).group_by(func.date(models.Post.updated_at)).all()
    
    view_stats = []
    for i in range(7):
        date = (_now_kst - timedelta(days=6-i)).date()
        views_result = next((v.total_views for v in recent_views if v.date == date), None)
        views = int(views_result) if views_result else 0
        view_stats.append({
            'date': date.strftime('%m/%d'),
            'views': views
        })
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "admin_email": user.email,
        "active_page": "dashboard",
        "stats": stats,
        "post_stats": post_stats,
        "view_stats": view_stats
    })


@router.get("/admin/notification-policy", response_class=HTMLResponse)
async def admin_notification_policy_placeholder(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "admin_placeholder.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "notification-policy",
            "page_title": "알림 정책",
            "page_message": "FCM·인앱 알림 on/off 및 문구 일원화는 후속 Phase에서 연결합니다.",
        },
    )


def _kiwoom_placeholder(request: Request, user, active_page: str, page_title: str):
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "admin_placeholder.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": active_page,
            "page_title": page_title,
            "page_message": "키움 REST API 연동은 KIWOOM_IMPLEMENTATION_PLAN 단계별로 구현 예정입니다.",
        },
    )


def _resolve_rank_stk_cd(raw: Optional[str]) -> str:
    """종목별 TR용 코드; 무효 시 삼성전자 예시."""
    s = (raw or "").strip()
    if not s:
        return "005930"
    try:
        return normalize_stk_cd(s)
    except ValueError:
        return "005930"


def _kiwoom_quotes_context(
    request: Request,
    user,
    *,
    stk_cd: str = "",
    rank_stk_cd: str = "005930",
    result: Optional[dict[str, Any]] = None,
    error: Optional[str] = None,
    response_json: Optional[str] = None,
    realtime_rows: Optional[list] = None,
    realtime_err: Optional[str] = None,
    realtime_raw: Optional[str] = None,
    day_vol_rows: Optional[list] = None,
    day_vol_err: Optional[str] = None,
    day_vol_raw: Optional[str] = None,
    prev_day_rows: Optional[list] = None,
    prev_day_err: Optional[str] = None,
    prev_day_raw: Optional[str] = None,
    trading_value_rows: Optional[list] = None,
    trading_value_err: Optional[str] = None,
    trading_value_raw: Optional[str] = None,
    upper_lower_rows: Optional[list] = None,
    upper_lower_err: Optional[str] = None,
    upper_lower_raw: Optional[str] = None,
    foreign_consec_rows: Optional[list] = None,
    foreign_consec_err: Optional[str] = None,
    foreign_consec_raw: Optional[str] = None,
    foreign_stk_rows: Optional[list] = None,
    foreign_stk_err: Optional[str] = None,
    foreign_stk_raw: Optional[str] = None,
    broker_rank_rows: Optional[list] = None,
    broker_rank_err: Optional[str] = None,
    broker_rank_raw: Optional[str] = None,
    inst_daily_rows: Optional[list] = None,
    inst_daily_err: Optional[str] = None,
    inst_daily_raw: Optional[str] = None,
) -> dict:
    svc = get_kiwoom_service()
    if config.KIWOOM_BASE_URL:
        base = str(config.KIWOOM_BASE_URL).rstrip("/")
    else:
        base = (
            "https://mockapi.kiwoom.com"
            if config.KIWOOM_USE_MOCK
            else "https://api.kiwoom.com"
        )
    return {
        "request": request,
        "admin_email": user.email,
        "active_page": "kiwoom-quotes",
        "page_title": "시세조회",
        "kiwoom_configured": svc is not None,
        "kiwoom_use_mock": config.KIWOOM_USE_MOCK,
        "kiwoom_base_url": base,
        "stk_cd": stk_cd,
        "rank_stk_cd": rank_stk_cd,
        "result": result,
        "error": error,
        "response_json": response_json,
        "realtime_rows": realtime_rows if realtime_rows is not None else [],
        "realtime_err": realtime_err,
        "realtime_raw": realtime_raw,
        "day_vol_rows": day_vol_rows if day_vol_rows is not None else [],
        "day_vol_err": day_vol_err,
        "day_vol_raw": day_vol_raw,
        "prev_day_rows": prev_day_rows if prev_day_rows is not None else [],
        "prev_day_err": prev_day_err,
        "prev_day_raw": prev_day_raw,
        "trading_value_rows": trading_value_rows if trading_value_rows is not None else [],
        "trading_value_err": trading_value_err,
        "trading_value_raw": trading_value_raw,
        "upper_lower_rows": upper_lower_rows if upper_lower_rows is not None else [],
        "upper_lower_err": upper_lower_err,
        "upper_lower_raw": upper_lower_raw,
        "foreign_consec_rows": foreign_consec_rows if foreign_consec_rows is not None else [],
        "foreign_consec_err": foreign_consec_err,
        "foreign_consec_raw": foreign_consec_raw,
        "foreign_stk_rows": foreign_stk_rows if foreign_stk_rows is not None else [],
        "foreign_stk_err": foreign_stk_err,
        "foreign_stk_raw": foreign_stk_raw,
        "broker_rank_rows": broker_rank_rows if broker_rank_rows is not None else [],
        "broker_rank_err": broker_rank_err,
        "broker_rank_raw": broker_rank_raw,
        "inst_daily_rows": inst_daily_rows if inst_daily_rows is not None else [],
        "inst_daily_err": inst_daily_err,
        "inst_daily_raw": inst_daily_raw,
    }


async def _kiwoom_quotes_rank_data(svc: Any, rank_stk_cd: str) -> dict[str, Any]:
    """순위·종목별 TR 병렬 조회(각 최대 50행 또는 원문 JSON)."""

    async def _one(coro):
        try:
            data = await coro
            if data.get("return_code") not in (0, None):
                return [], data.get("return_msg") or "API 오류", None
            rows = rank_rows_from_response(data)[:50]
            if rows:
                return rows, None, None
            return [], None, json.dumps(data, ensure_ascii=False, indent=2)
        except KiwoomApiError as e:
            return [], str(e), None

    (
        rt_rt,
        rt_day,
        rt_prev,
        rt_tv,
        rt_ul,
        rt_fc,
        rt_f8,
        rt_b38,
        rt_44,
    ) = await asyncio.gather(
        _one(svc.fetch_realtime_lookup_rank()),
        _one(svc.fetch_day_volume_top()),
        _one(svc.fetch_prev_day_volume_top()),
        _one(svc.fetch_trading_value_top()),
        _one(svc.fetch_upper_lower_limit()),
        _one(svc.fetch_foreign_consecutive_net_top()),
        _one(svc.fetch_foreign_trading_by_stock(rank_stk_cd)),
        _one(svc.fetch_broker_rank_by_stock(rank_stk_cd)),
        _one(svc.fetch_institutional_daily(rank_stk_cd)),
    )

    return {
        "realtime_rows": rt_rt[0],
        "realtime_err": rt_rt[1],
        "realtime_raw": rt_rt[2],
        "day_vol_rows": rt_day[0],
        "day_vol_err": rt_day[1],
        "day_vol_raw": rt_day[2],
        "prev_day_rows": rt_prev[0],
        "prev_day_err": rt_prev[1],
        "prev_day_raw": rt_prev[2],
        "trading_value_rows": rt_tv[0],
        "trading_value_err": rt_tv[1],
        "trading_value_raw": rt_tv[2],
        "upper_lower_rows": rt_ul[0],
        "upper_lower_err": rt_ul[1],
        "upper_lower_raw": rt_ul[2],
        "foreign_consec_rows": rt_fc[0],
        "foreign_consec_err": rt_fc[1],
        "foreign_consec_raw": rt_fc[2],
        "foreign_stk_rows": rt_f8[0],
        "foreign_stk_err": rt_f8[1],
        "foreign_stk_raw": rt_f8[2],
        "broker_rank_rows": rt_b38[0],
        "broker_rank_err": rt_b38[1],
        "broker_rank_raw": rt_b38[2],
        "inst_daily_rows": rt_44[0],
        "inst_daily_err": rt_44[1],
        "inst_daily_raw": rt_44[2],
    }


@router.get("/admin/kiwoom/quotes", response_class=HTMLResponse)
async def admin_kiwoom_quotes(
    request: Request,
    user=Depends(get_current_user),
    stk_cd: Optional[str] = None,
    rank_stk_cd: Optional[str] = None,
):
    if not user:
        return RedirectResponse(url="/")
    q = (stk_cd or "").strip()
    rcode = _resolve_rank_stk_cd(rank_stk_cd)
    ctx = _kiwoom_quotes_context(request, user, stk_cd=q, rank_stk_cd=rcode)
    svc = get_kiwoom_service()
    if svc:
        ctx.update(await _kiwoom_quotes_rank_data(svc, rcode))
    return templates.TemplateResponse("kiwoom_quotes.html", ctx)


@router.post("/admin/kiwoom/quotes", response_class=HTMLResponse)
async def admin_kiwoom_quotes_post(
    request: Request,
    user=Depends(get_current_user),
    stk_cd: str = Form(""),
    rank_stk_cd: str = Form(""),
):
    if not user:
        return RedirectResponse(url="/")

    svc = get_kiwoom_service()
    rcode = _resolve_rank_stk_cd((rank_stk_cd or "").strip() or stk_cd.strip() or None)

    if not svc:
        return templates.TemplateResponse(
            "kiwoom_quotes.html",
            _kiwoom_quotes_context(
                request,
                user,
                stk_cd=stk_cd.strip(),
                rank_stk_cd=rcode,
                error="KIWOOM_APP_KEY / KIWOOM_APP_SECRET 환경 변수를 설정하세요.",
            ),
        )

    rank_kw = await _kiwoom_quotes_rank_data(svc, rcode)

    try:
        code = normalize_stk_cd(stk_cd)
    except ValueError as e:
        ctx = _kiwoom_quotes_context(
            request,
            user,
            stk_cd=stk_cd.strip(),
            rank_stk_cd=rcode,
            error=str(e),
            **rank_kw,
        )
        return templates.TemplateResponse("kiwoom_quotes.html", ctx)

    try:
        data = await svc.fetch_stock_basic_info(code)
    except KiwoomApiError as e:
        ctx = _kiwoom_quotes_context(
            request, user, stk_cd=code, rank_stk_cd=rcode, error=str(e), **rank_kw
        )
        return templates.TemplateResponse("kiwoom_quotes.html", ctx)

    response_json = json.dumps(data, ensure_ascii=False, indent=2)
    err_msg: Optional[str] = None
    if data.get("return_code") not in (0, None):
        err_msg = data.get("return_msg") or "API 오류"

    ctx = _kiwoom_quotes_context(
        request,
        user,
        stk_cd=code,
        rank_stk_cd=rcode,
        result=data if not err_msg else None,
        error=err_msg,
        response_json=response_json,
        **rank_kw,
    )
    return templates.TemplateResponse("kiwoom_quotes.html", ctx)


@router.get("/admin/kiwoom/screening", response_class=HTMLResponse)
async def admin_kiwoom_screening(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "kiwoom_screening.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "kiwoom-screening",
            "page_title": "Kiwoom 조건검색 (ka10081)",
            "screening_price_source": config.KIWOOM_SCREENING_PRICE_SOURCE,
            "kiwoom_configured": get_kiwoom_service() is not None,
            "screening_result": None,
            "screening_error": None,
            "form_market": "kospi",
            "form_top_n": 40,
            "form_screening_mode": "ichimoku",
            "ks": _kiwoom_screening_ko_strings(),
        },
    )


@router.post("/admin/kiwoom/screening", response_class=HTMLResponse)
async def admin_kiwoom_screening_post(
    request: Request,
    user=Depends(get_current_user),
    market: str = Form("kospi"),
    top_n: int = Form(40),
    screening_mode: str = Form("ichimoku"),
):
    if not user:
        return RedirectResponse(url="/")

    screening_error: Optional[str] = None
    screening_result: Optional[dict[str, Any]] = None
    mode = (screening_mode or "ichimoku").strip().lower()
    try:
        screening_result = await run_kiwoom_screening(
            mode=mode,
            market=market,
            top_n=top_n,
        )
        if not screening_result.get("ok"):
            screening_error = screening_result.get("error") or "실행 실패"
    except Exception as e:
        screening_error = str(e)

    return templates.TemplateResponse(
        "kiwoom_screening.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "kiwoom-screening",
            "page_title": "Kiwoom 조건검색 (ka10081)",
            "screening_price_source": config.KIWOOM_SCREENING_PRICE_SOURCE,
            "kiwoom_configured": get_kiwoom_service() is not None,
            "screening_result": screening_result,
            "screening_error": screening_error,
            "form_market": (market or "kospi").lower(),
            "form_top_n": top_n,
            "form_screening_mode": mode,
            "ks": _kiwoom_screening_ko_strings(),
        },
    )


@router.get("/admin/kiwoom/mock", response_class=HTMLResponse)
async def admin_kiwoom_mock(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/")
    return await _admin_kiwoom_mock_page(request, user, post_message=None, post_error=None)


@router.post("/admin/kiwoom/mock", response_class=HTMLResponse)
async def admin_kiwoom_mock_post(
    request: Request,
    user=Depends(get_current_user),
    action: str = Form(""),
    stk_cd: str = Form(""),
    ord_qty: str = Form(""),
    ord_prc: str = Form(""),
    orgn_ord_no: str = Form(""),
):
    if not user:
        return RedirectResponse(url="/")

    post_message: Optional[str] = None
    post_error: Optional[str] = None

    if config.KIWOOM_ORDER_KILL_SWITCH:
        post_error = "KIWOOM_ORDER_KILL_SWITCH 가 켜져 있어 주문을 보낼 수 없습니다."
        return await _admin_kiwoom_mock_page(request, user, post_message, post_error)

    mock = get_mock_trading_service()
    if mock is None:
        post_error = "KIWOOM 자격 증명이 없습니다."
        return await _admin_kiwoom_mock_page(request, user, post_message, post_error)

    act = (action or "").strip().lower()
    if act not in ("buy", "sell", "cancel"):
        post_error = "유효하지 않은 주문 유형입니다."
        return await _admin_kiwoom_mock_page(request, user, post_message, post_error)

    body: dict[str, Any] = {}
    if stk_cd.strip():
        try:
            body["stk_cd"] = normalize_stk_cd(stk_cd.strip())
        except ValueError as e:
            post_error = str(e)
            return await _admin_kiwoom_mock_page(request, user, post_message, post_error)
    if ord_qty.strip():
        body["ord_qty"] = ord_qty.strip()
    if ord_prc.strip():
        body["ord_prc"] = ord_prc.strip()
    if orgn_ord_no.strip():
        body["orgn_ord_no"] = orgn_ord_no.strip()

    try:
        if act == "buy":
            data = await mock.place_buy_order(body)
        elif act == "sell":
            data = await mock.place_sell_order(body)
        else:
            data = await mock.cancel_order(body)
        post_message = json.dumps(data, ensure_ascii=False, indent=2)
    except KiwoomApiError as e:
        post_error = str(e)

    return await _admin_kiwoom_mock_page(request, user, post_message, post_error)


async def _admin_kiwoom_mock_page(
    request: Request,
    user,
    post_message: Optional[str],
    post_error: Optional[str],
):
    bundle: Optional[dict[str, Any]] = None
    unfilled: Optional[dict[str, Any]] = None
    load_errors: list[str] = []

    mock = get_mock_trading_service()
    svc_ok = get_kiwoom_service() is not None
    account_ok = bool(config.KIWOOM_ACCOUNT_NO and str(config.KIWOOM_ACCOUNT_NO).strip())

    if mock and account_ok:
        try:
            bundle = await mock.get_balance_bundle()
        except Exception as e:
            load_errors.append(str(e))
        try:
            unfilled = await mock.fetch_unfilled_orders()
        except Exception as e:
            load_errors.append(f"미체결: {e}")
    elif mock and not account_ok:
        load_errors.append("KIWOOM_ACCOUNT_NO 가 비어 있습니다.")

    def _fmt(obj: Optional[dict[str, Any]]) -> str:
        if obj is None:
            return ""
        return json.dumps(obj, ensure_ascii=False, indent=2)

    return templates.TemplateResponse(
        "kiwoom_mock.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "kiwoom-mock",
            "page_title": "모의매매",
            "kiwoom_configured": svc_ok,
            "account_configured": account_ok,
            "bundle": bundle,
            "unfilled": unfilled,
            "bundle_json": _fmt(bundle),
            "unfilled_json": _fmt(unfilled),
            "load_errors": load_errors,
            "order_kill_switch": config.KIWOOM_ORDER_KILL_SWITCH,
            "post_message": post_message,
            "post_error": post_error,
        },
    )


@router.get("/admin/kiwoom/auto", response_class=HTMLResponse)
async def admin_kiwoom_auto(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/")
    auto = get_auto_trading_service()
    return templates.TemplateResponse(
        "kiwoom_auto.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "kiwoom-auto",
            "page_title": "자동매매",
            "strategies": auto.list_strategies(),
            "kill_switch": config.KIWOOM_KILL_SWITCH,
            "auto_trading_enabled": config.KIWOOM_AUTO_TRADING_ENABLED,
            "order_kill_switch": config.KIWOOM_ORDER_KILL_SWITCH,
            "strategy_message": None,
            "strategy_error": None,
        },
    )


@router.post("/admin/kiwoom/auto", response_class=HTMLResponse)
async def admin_kiwoom_auto_post(
    request: Request,
    user=Depends(get_current_user),
    strategy_name: str = Form(""),
):
    if not user:
        return RedirectResponse(url="/")

    strategy_message: Optional[str] = None
    strategy_error: Optional[str] = None

    name = (strategy_name or "").strip() or "unnamed"
    auto = get_auto_trading_service()
    try:
        sid = auto.create_strategy(AutoStrategySpec(name=name, rule_json={}))
        strategy_message = f"전략이 등록되었습니다 (메모리, id={sid})."
    except Exception as e:
        strategy_error = str(e)

    return templates.TemplateResponse(
        "kiwoom_auto.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "kiwoom-auto",
            "page_title": "자동매매",
            "strategies": auto.list_strategies(),
            "kill_switch": config.KIWOOM_KILL_SWITCH,
            "auto_trading_enabled": config.KIWOOM_AUTO_TRADING_ENABLED,
            "order_kill_switch": config.KIWOOM_ORDER_KILL_SWITCH,
            "strategy_message": strategy_message,
            "strategy_error": strategy_error,
        },
    )

