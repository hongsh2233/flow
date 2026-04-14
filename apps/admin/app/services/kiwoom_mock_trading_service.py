"""
Kiwoom 모의투자(또는 동일 TR의 실계좌) — 계좌/주문 TR 래퍼.

계좌번호는 `KIWOOM_ACCOUNT_NO` (선택 `KIWOOM_ACCOUNT_PWD`) 필요.
모의는 `KIWOOM_USE_MOCK=true` 및 mockapi 호스트 권장.
"""
from __future__ import annotations

from typing import Any, Optional

from app import config
from app.services.kiwoom_service import KiwoomApiError, KiwoomService

# TR ids (국내주식 계좌·주문)
API_DEPOSIT_DETAIL = "kt00001"  # 예수금상세현황요청
API_BALANCE = "kt00005"  # 체결잔고요청
API_UNFILLED = "kt10075"  # 미체결요청 (오류 시 공식 가이드 TR명 확인)
API_ORDER_BUY = "kt10000"  # 주식 매수
API_ORDER_SELL = "kt10001"  # 주식 매도
API_ORDER_CANCEL = "kt10003"  # 취소


def _require_account() -> tuple[str, str]:
    acnt = (config.KIWOOM_ACCOUNT_NO or "").strip()
    if not acnt:
        raise ValueError(
            "KIWOOM_ACCOUNT_NO 가 설정되지 않았습니다. .env.local 에 계좌번호를 넣으세요."
        )
    pwd = config.KIWOOM_ACCOUNT_PWD or ""
    return acnt, pwd


def _default_acnt_body() -> dict[str, Any]:
    acnt, pwd = _require_account()
    return {
        "acnt_no": acnt,
        "pwd": pwd,
    }


class KiwoomMockTradingService:
    """모의/실계좌 조회 및 주문 (Kiwoom REST TR)."""

    def __init__(self, svc: KiwoomService):
        self._svc = svc

    async def fetch_deposit_detail(self) -> dict[str, Any]:
        """kt00001 예수금 상세."""
        body = {**_default_acnt_body(), "qry_tp": "1"}
        return await self._svc.call_acnt(API_DEPOSIT_DETAIL, body)

    async def fetch_positions(self) -> dict[str, Any]:
        """kt00005 체결 잔고."""
        body = {**_default_acnt_body(), "qry_tp": "1"}
        return await self._svc.call_acnt(API_BALANCE, body)

    async def fetch_unfilled_orders(self) -> dict[str, Any]:
        """kt10075 미체결."""
        body = {**_default_acnt_body()}
        return await self._svc.call_acnt(API_UNFILLED, body)

    async def place_buy_order(self, order_body: dict[str, Any]) -> dict[str, Any]:
        """kt10000 매수 — order_body에 종목·수량·가격 등 (가이드 필드명 준수)."""
        base = _default_acnt_body()
        merged = {**base, **order_body}
        return await self._svc.call_ordr(API_ORDER_BUY, merged)

    async def place_sell_order(self, order_body: dict[str, Any]) -> dict[str, Any]:
        """kt10001 매도."""
        base = _default_acnt_body()
        merged = {**base, **order_body}
        return await self._svc.call_ordr(API_ORDER_SELL, merged)

    async def cancel_order(self, order_body: dict[str, Any]) -> dict[str, Any]:
        """kt10003 취소 — 원주문번호 등 order_body."""
        base = _default_acnt_body()
        merged = {**base, **order_body}
        return await self._svc.call_ordr(API_ORDER_CANCEL, merged)

    async def get_balance_bundle(self) -> dict[str, Any]:
        """예수금 + 잔고를 한 번에 (개별 오류는 메시지로)."""
        out: dict[str, Any] = {"deposit": None, "positions": None, "errors": []}
        try:
            out["deposit"] = await self.fetch_deposit_detail()
        except (KiwoomApiError, ValueError) as e:
            out["errors"].append({"step": "deposit", "message": str(e)})
        try:
            out["positions"] = await self.fetch_positions()
        except (KiwoomApiError, ValueError) as e:
            out["errors"].append({"step": "positions", "message": str(e)})
        return out


def get_mock_trading_service(svc: Optional[KiwoomService] = None) -> Optional[KiwoomMockTradingService]:
    if svc is None:
        from app.services.kiwoom_service import get_kiwoom_service

        svc = get_kiwoom_service()
    if svc is None:
        return None
    return KiwoomMockTradingService(svc)
