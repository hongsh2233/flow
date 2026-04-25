"""
Kiwoom 일봉·현재가 등 시세 TR (스크리닝·차트용).

일봉: ka10081 주식일봉차트조회요청 — POST /api/dostk/chart
현재가 요약: ka10001 (기존 fetch_stock_basic_info 재사용)
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.services.kiwoom_chart_parser import (
    extract_chart_row_dicts,
    ka10081_pages_to_dataframe,
)
from app.services.kiwoom_service import KiwoomService

KST = ZoneInfo("Asia/Seoul")

logger = logging.getLogger(__name__)

# 주식일봉차트조회요청
API_DAILY_CHART = "ka10081"


class KiwoomPriceService:
    def __init__(self, svc: KiwoomService):
        self._svc = svc

    async def fetch_daily_chart(
        self,
        stk_cd: str,
        *,
        base_dt: Optional[str] = None,
        upd_stkpc_tp: str = "1",
    ) -> dict[str, Any]:
        """
        ka10081 일봉 차트. base_dt 미지정 시 당일(KST) 기준.
        Body 필드는 가이드와 동기화 필요할 수 있음 (mrkt_tp, adj_prc_tp 등).
        """
        code = (stk_cd or "").strip().zfill(6)
        if base_dt is None:
            base_dt = datetime.now(tz=KST).strftime("%Y%m%d")
        body: dict[str, Any] = {
            "stk_cd": code,
            "base_dt": base_dt,
            "upd_stkpc_tp": upd_stkpc_tp,
        }
        return await self._svc.call_chart(API_DAILY_CHART, body)

    async def fetch_daily_chart_range(
        self,
        stk_cd: str,
        *,
        days: int = 120,
    ) -> dict[str, Any]:
        """단일 base_dt 요청(연속조회 미구현). days는 힌트로만 사용."""
        _ = days
        return await self.fetch_daily_chart(stk_cd)

    async def fetch_daily_ohlcv_dataframe(
        self,
        stk_cd: str,
        *,
        min_rows: int = 260,
        max_pages: int = 40,
        upd_stkpc_tp: str = "1",
    ):
        """
        ka10081 연속조회로 일봉을 모아 OHLCV DataFrame 반환 (일목 스크리닝용).
        파싱 실패 시 None.
        """
        import pandas as pd

        code = (stk_cd or "").strip().zfill(6)
        base_dt = datetime.now(tz=KST).strftime("%Y%m%d")
        all_rows: list[dict[str, Any]] = []
        cont_yn = "N"
        next_key = ""

        for page in range(max_pages):
            body: dict[str, Any] = {
                "stk_cd": code,
                "base_dt": base_dt,
                "upd_stkpc_tp": upd_stkpc_tp,
            }
            try:
                data = await self._svc.call_chart(
                    API_DAILY_CHART,
                    body,
                    cont_yn=cont_yn,
                    next_key=next_key,
                )
            except Exception as e:
                logger.debug("ka10081 %s page %s: %s", code, page, e)
                break

            if data.get("return_code") not in (0, None):
                if page == 0:
                    logger.debug(
                        "ka10081 %s return_code=%s msg=%s",
                        code,
                        data.get("return_code"),
                        data.get("return_msg"),
                    )
                break

            chunk = extract_chart_row_dicts(data)
            if chunk:
                all_rows.extend(chunk)

            if len(all_rows) >= min_rows:
                break

            cty = str(data.get("cont_yn") or "N").strip().upper()
            nk = str(data.get("next_key") or "").strip()
            if cty != "Y" or not nk:
                break
            cont_yn = "Y"
            next_key = nk

        if not all_rows:
            return None

        df = ka10081_pages_to_dataframe(all_rows)
        if df is None or len(df) < min_rows:
            return None

        for col in ("Open", "High", "Low", "Close", "Volume"):
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna(subset=["Close"])
        if len(df) < min_rows:
            return None
        return df

    async def fetch_current_snapshot(self, stk_cd: str) -> dict[str, Any]:
        """ka10001 종목 기본 정보."""
        code = (stk_cd or "").strip().zfill(6)
        return await self._svc.fetch_stock_basic_info(code)


def get_kiwoom_price_service(svc: Optional[KiwoomService] = None) -> Optional[KiwoomPriceService]:
    if svc is None:
        from app.services.kiwoom_service import get_kiwoom_service

        svc = get_kiwoom_service()
    if svc is None:
        return None
    return KiwoomPriceService(svc)
