"""
스크리닝 진행상태 인메모리 저장소.
BO 전용 - DB/Redis 불필요. 서버 프로세스 내 dict로 관리.
"""
from datetime import datetime
from typing import Dict

import pytz

KST = pytz.timezone("Asia/Seoul")

_progress: Dict[str, dict] = {}


def reset_progress(screening_type: str):
    """스크리닝 시작 시 초기화"""
    _progress[screening_type] = {
        "status": "running",
        "phase": "초기화",
        "current": 0,
        "total": 0,
        "message": "스크리닝을 시작합니다...",
        "started_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
    }


def update_progress(
    screening_type: str,
    *,
    status: str = "running",
    phase: str = "",
    current: int = 0,
    total: int = 0,
    message: str = "",
):
    """진행상태 업데이트"""
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    entry = _progress.get(screening_type, {})
    entry.update({
        "status": status,
        "phase": phase,
        "current": current,
        "total": total,
        "message": message,
        "updated_at": now,
    })
    if status in ("completed", "error"):
        entry["completed_at"] = now
    _progress[screening_type] = entry


def get_progress(screening_type: str) -> dict:
    """현재 진행상태 조회 (폴링 응답용)"""
    return _progress.get(screening_type, {"status": "idle"})
