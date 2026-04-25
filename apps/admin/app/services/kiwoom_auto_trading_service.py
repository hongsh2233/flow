"""
자동매매 전략 (Phase 4 스켈레톤).

실주문 전 반드시 모의·Kill-switch·사용자 확인(Confirmation) 플로우를 도입할 것.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional
import uuid


@dataclass
class AutoStrategySpec:
    """전략 정의(확장용)."""

    name: str = ""
    rule_json: dict[str, Any] = field(default_factory=dict)


class KiwoomAutoTradingService:
    """향후: 전략 저장, 조건 충족 시 주문 실행(확인 필수)."""

    def __init__(self) -> None:
        self._strategies: dict[str, AutoStrategySpec] = {}

    def create_strategy(self, spec: AutoStrategySpec) -> str:
        sid = str(uuid.uuid4())
        self._strategies[sid] = spec
        return sid

    def get_strategy(self, strategy_id: str) -> Optional[AutoStrategySpec]:
        return self._strategies.get(strategy_id)

    def list_strategies(self) -> list[dict[str, Any]]:
        return [
            {"id": k, "name": v.name, "rules": v.rule_json}
            for k, v in self._strategies.items()
        ]

    def stop_strategy(self, strategy_id: str) -> bool:
        return self._strategies.pop(strategy_id, None) is not None

    async def execute_order(self, strategy_id: str, *, confirmed: bool = False) -> dict[str, Any]:
        """실제 주문은 confirmed=True 및 운영 플래그 후에만 연결."""
        if not confirmed:
            return {
                "ok": False,
                "error": "confirmation_required",
                "message": "자동 주문은 확인 플로우·Kill-switch 도입 후에만 활성화합니다.",
            }
        return {"ok": False, "error": "not_implemented", "strategy_id": strategy_id}


_auto_singleton: Optional[KiwoomAutoTradingService] = None


def get_auto_trading_service() -> KiwoomAutoTradingService:
    global _auto_singleton
    if _auto_singleton is None:
        _auto_singleton = KiwoomAutoTradingService()
    return _auto_singleton
