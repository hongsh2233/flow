"""
스크리닝 파이프라인과 Kiwoom 가격 소스 설정 연동.

`KIWOOM_SCREENING_PRICE_SOURCE=kiwoom` 일 때 OHLCV는 아직 FinanceDataReader로 수집하며,
향후 ka10081 비동기 배치로 대체할 수 있도록 경고 로그를 남깁니다.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)
_warned_kiwoom_pending = False


def warn_if_kiwoom_pending() -> None:
    """FDR 기반 스크리닝에서 kiwoom 소스가 요청된 경우 1회 경고."""
    global _warned_kiwoom_pending
    from app import config

    if getattr(config, "KIWOOM_SCREENING_PRICE_SOURCE", "fdr") != "kiwoom":
        return
    if _warned_kiwoom_pending:
        return
    _warned_kiwoom_pending = True
    logger.warning(
        "KIWOOM_SCREENING_PRICE_SOURCE=kiwoom 이지만 OHLCV는 아직 FDR로 수집합니다. "
        "Kiwoom 일봉(ka10081) 배치 연동은 후속 작업입니다."
    )
