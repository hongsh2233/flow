"""
Kiwoom REST API — 운영/검증용 JSON 엔드포인트 (BO 인증).

- GET  /api/kiwoom/health  — 자격 증명·토큰 발급 가능 여부
- POST /api/kiwoom/auth/token — 접근 토큰 발급 응답(관리자 전용)
- Phase 2: /api/kiwoom/mock/*
- Phase 3: /api/kiwoom/prices/*, /api/kiwoom/price/*/current
- Phase 4: /api/kiwoom/strategies/*
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.dependencies import get_current_user
from app import config
from app.services.kiwoom_auto_trading_service import (
    AutoStrategySpec,
    get_auto_trading_service,
)
from app.services.kiwoom_mock_trading_service import get_mock_trading_service
from app.services.kiwoom_price_service import get_kiwoom_price_service
from app.services.kiwoom_service import (
    KiwoomApiError,
    get_kiwoom_service,
    normalize_stk_cd,
    _kiwoom_base_url,
)

router = APIRouter(prefix="/api/kiwoom", tags=["kiwoom"])
logger = logging.getLogger(__name__)


def _audit(user: Any, event: str, **kwargs: Any) -> None:
    logger.info(
        "kiwoom_audit event=%s user_email=%s detail=%s",
        event,
        getattr(user, "email", None),
        kwargs,
    )


def _base_info() -> dict[str, Any]:
    base = _kiwoom_base_url()
    return {
        "base_url": base,
        "use_mock": bool(config.KIWOOM_USE_MOCK),
    }


def _require_kiwoom_svc():
    svc = get_kiwoom_service()
    if svc is None:
        raise HTTPException(
            status_code=503,
            detail="KIWOOM_APP_KEY / KIWOOM_APP_SECRET 미설정",
        )
    return svc


@router.get("/health")
async def kiwoom_health(user=Depends(get_current_user)) -> JSONResponse:
    """KIWOOM_APP_KEY/SECRET 설정 및 OAuth2 토큰 발급 가능 여부."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    svc = get_kiwoom_service()
    if svc is None:
        return JSONResponse(
            status_code=503,
            content={
                "status": "disabled",
                "configured": False,
                "message": "KIWOOM_APP_KEY / KIWOOM_APP_SECRET 미설정",
                **_base_info(),
            },
        )

    try:
        await svc.get_access_token()
    except KiwoomApiError as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "configured": True,
                "message": str(e),
                **_base_info(),
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "configured": True,
            "message": "토큰 발급 성공",
            **_base_info(),
        },
    )


@router.post("/auth/token")
async def kiwoom_auth_token(user=Depends(get_current_user)) -> JSONResponse:
    """키움 OAuth2 토큰 발급 결과(관리자 전용). 응답에 token 포함 — 외부 노출 주의."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    svc = get_kiwoom_service()
    if svc is None:
        raise HTTPException(
            status_code=503,
            detail="KIWOOM_APP_KEY / KIWOOM_APP_SECRET 미설정",
        )

    try:
        token = await svc.get_access_token()
    except KiwoomApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    exp = svc.get_token_expires_at()
    expires_iso: Optional[str] = exp.isoformat() if exp else None

    return JSONResponse(
        status_code=200,
        content={
            "token_type": "Bearer",
            "token": token,
            "expires_at": expires_iso,
            **_base_info(),
        },
    )


# --- Phase 2: mock / account TR ---


@router.get("/mock/balance")
async def kiwoom_mock_balance(user=Depends(get_current_user)) -> JSONResponse:
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    _require_kiwoom_svc()
    mock = get_mock_trading_service()
    if mock is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")
    try:
        data = await mock.get_balance_bundle()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    _audit(user, "mock_balance")
    return JSONResponse(content=data)


@router.get("/mock/orders")
async def kiwoom_mock_orders(user=Depends(get_current_user)) -> JSONResponse:
    """미체결 위주(kt10075)."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    _require_kiwoom_svc()
    mock = get_mock_trading_service()
    if mock is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")
    try:
        data = await mock.fetch_unfilled_orders()
    except (KiwoomApiError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    _audit(user, "mock_orders_list")
    return JSONResponse(content=data)


@router.get("/mock/portfolio")
async def kiwoom_mock_portfolio(user=Depends(get_current_user)) -> JSONResponse:
    """예수금 + 잔고(체결) 요약."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    _require_kiwoom_svc()
    mock = get_mock_trading_service()
    if mock is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")
    try:
        bundle = await mock.get_balance_bundle()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    _audit(user, "mock_portfolio")
    return JSONResponse(content=bundle)


@router.post("/mock/order")
async def kiwoom_mock_order(
    user=Depends(get_current_user),
    body: dict[str, Any] = Body(...),
) -> JSONResponse:
    """
    통합 주문: body.side = buy | sell | cancel, 나머지 필드는 Kiwoom TR 본문에 병합.
    """
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if config.KIWOOM_ORDER_KILL_SWITCH:
        raise HTTPException(
            status_code=403,
            detail="KIWOOM_ORDER_KILL_SWITCH 가 켜져 있어 주문 API가 비활성화되었습니다.",
        )
    _require_kiwoom_svc()
    mock = get_mock_trading_service()
    if mock is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")

    side = (body.get("side") or "").strip().lower()
    payload = {k: v for k, v in body.items() if k != "side"}

    if "stk_cd" in payload and payload["stk_cd"]:
        try:
            payload["stk_cd"] = normalize_stk_cd(str(payload["stk_cd"]))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        if side == "buy":
            data = await mock.place_buy_order(payload)
        elif side == "sell":
            data = await mock.place_sell_order(payload)
        elif side == "cancel":
            data = await mock.cancel_order(payload)
        else:
            raise HTTPException(
                status_code=400,
                detail='body.side 는 "buy", "sell", "cancel" 중 하나여야 합니다.',
            )
    except KiwoomApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    _audit(user, "mock_order", side=side, stk_cd=payload.get("stk_cd"))
    return JSONResponse(content=data)


@router.delete("/mock/order/{order_id}")
async def kiwoom_mock_order_cancel(
    order_id: str,
    user=Depends(get_current_user),
    body: Optional[dict[str, Any]] = Body(None),
) -> JSONResponse:
    """취소: path의 order_id를 orgn_ord_no 등으로 매핑해 kt10003 호출."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if config.KIWOOM_ORDER_KILL_SWITCH:
        raise HTTPException(
            status_code=403,
            detail="KIWOOM_ORDER_KILL_SWITCH 가 켜져 있어 주문 API가 비활성화되었습니다.",
        )
    _require_kiwoom_svc()
    mock = get_mock_trading_service()
    if mock is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")

    merged: dict[str, Any] = dict(body or {})
    merged.setdefault("orgn_ord_no", order_id)

    try:
        data = await mock.cancel_order(merged)
    except KiwoomApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    _audit(user, "mock_order_cancel", order_id=order_id)
    return JSONResponse(content=data)


# --- Phase 3: prices ---


@router.get("/prices/{symbol}")
async def kiwoom_prices_daily(
    symbol: str,
    user=Depends(get_current_user),
    base_dt: Optional[str] = None,
    days: int = 120,
) -> JSONResponse:
    """ka10081 일봉 (days는 힌트, 연속조회 미구현)."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    _require_kiwoom_svc()
    price = get_kiwoom_price_service()
    if price is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")
    try:
        code = normalize_stk_cd(symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        data = await price.fetch_daily_chart(code, base_dt=base_dt)
    except KiwoomApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    _audit(user, "prices_daily", symbol=code, days_hint=days)
    return JSONResponse(content=data)


@router.get("/price/{symbol}/current")
async def kiwoom_price_current(symbol: str, user=Depends(get_current_user)) -> JSONResponse:
    """ka10001 현재가·종목 요약."""
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    _require_kiwoom_svc()
    price = get_kiwoom_price_service()
    if price is None:
        raise HTTPException(status_code=503, detail="Kiwoom 서비스를 사용할 수 없습니다.")
    try:
        code = normalize_stk_cd(symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        data = await price.fetch_current_snapshot(code)
    except KiwoomApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    _audit(user, "price_current", symbol=code)
    return JSONResponse(content=data)


# --- Phase 4: strategies (skeleton) ---


@router.get("/strategies")
async def kiwoom_strategies_list(user=Depends(get_current_user)) -> JSONResponse:
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    auto = get_auto_trading_service()
    return JSONResponse(
        content={
            "strategies": auto.list_strategies(),
            "kill_switch": config.KIWOOM_KILL_SWITCH,
            "auto_trading_enabled": config.KIWOOM_AUTO_TRADING_ENABLED,
        }
    )


@router.get("/strategies/{strategy_id}")
async def kiwoom_strategies_get(strategy_id: str, user=Depends(get_current_user)) -> JSONResponse:
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    auto = get_auto_trading_service()
    spec = auto.get_strategy(strategy_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="전략을 찾을 수 없습니다.")
    return JSONResponse(
        content={
            "id": strategy_id,
            "name": spec.name,
            "rules": spec.rule_json,
            "kill_switch": config.KIWOOM_KILL_SWITCH,
            "auto_trading_enabled": config.KIWOOM_AUTO_TRADING_ENABLED,
        }
    )


@router.post("/strategies")
async def kiwoom_strategies_create(
    user=Depends(get_current_user),
    body: Optional[dict[str, Any]] = Body(None),
) -> JSONResponse:
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    body = body or {}
    name = (body.get("name") or "").strip() or "unnamed"
    rules = body.get("rules") if isinstance(body.get("rules"), dict) else {}
    auto = get_auto_trading_service()
    sid = auto.create_strategy(AutoStrategySpec(name=name, rule_json=rules))
    _audit(user, "strategy_create", strategy_id=sid, name=name)
    return JSONResponse(content={"id": sid, "name": name})


@router.delete("/strategies/{strategy_id}")
async def kiwoom_strategies_delete(strategy_id: str, user=Depends(get_current_user)) -> JSONResponse:
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    auto = get_auto_trading_service()
    ok = auto.stop_strategy(strategy_id)
    if not ok:
        raise HTTPException(status_code=404, detail="전략을 찾을 수 없습니다.")
    _audit(user, "strategy_delete", strategy_id=strategy_id)
    return JSONResponse(content={"ok": True})


@router.post("/strategies/{strategy_id}/execute")
async def kiwoom_strategies_execute(
    strategy_id: str,
    user=Depends(get_current_user),
    body: Optional[dict[str, Any]] = Body(None),
) -> JSONResponse:
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if config.KIWOOM_KILL_SWITCH:
        raise HTTPException(
            status_code=403,
            detail="KIWOOM_KILL_SWITCH 가 켜져 있어 자동 실행이 차단되었습니다.",
        )
    if not config.KIWOOM_AUTO_TRADING_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="KIWOOM_AUTO_TRADING_ENABLED=false 입니다. 실주문 연동 전에는 비활성화합니다.",
        )
    body = body or {}
    confirmed = bool(body.get("confirmed"))
    auto = get_auto_trading_service()
    if auto.get_strategy(strategy_id) is None:
        raise HTTPException(status_code=404, detail="전략을 찾을 수 없습니다.")
    result = await auto.execute_order(strategy_id, confirmed=confirmed)
    _audit(user, "strategy_execute", strategy_id=strategy_id, confirmed=confirmed)
    return JSONResponse(content=result)


@router.post("/screening/run")
async def kiwoom_screening_run(
    user=Depends(get_current_user),
    body: Optional[dict[str, Any]] = Body(None),
) -> JSONResponse:
    """
    Kiwoom ka10081 daily bars; same screening logic as /admin/stock-screening by mode.
    body: { "mode": "ichimoku"|"jongbe"|"ricebowl"|"breakout", "market": "kospi"|"kosdaq", "top_n": 40 }
    """
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    from app.services.kiwoom_multi_screening_service import run_kiwoom_screening

    body = body or {}
    market = str(body.get("market") or "kospi")
    mode = str(body.get("mode") or body.get("screening_mode") or "ichimoku")
    try:
        top_n = int(body.get("top_n") or 40)
    except (TypeError, ValueError):
        top_n = 40

    result = await run_kiwoom_screening(mode=mode, market=market, top_n=top_n)
    _audit(
        user,
        "screening_run",
        market=market,
        top_n=top_n,
        mode=result.get("mode"),
        hit_count=result.get("hit_count"),
    )
    return JSONResponse(content=result)
