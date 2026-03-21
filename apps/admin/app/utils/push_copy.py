"""
FCM / 앱 내 알림 문구 — 브랜드 통일 및 클릭 유도 톤
"""
from __future__ import annotations

# 앱 표기명 (로그인 화면 등과 동일)
APP_NAME = "플로우"


def _truncate(s: str, max_len: int) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def noti_new_post(board_name: str, post_title: str) -> tuple[str, str]:
    """앱 알림센터용 (title, message)"""
    title = f"[{APP_NAME}] 새 글이 올라왔어요"
    hook = post_title.strip() or "새 게시글"
    if board_name:
        message = f"{hook} · {board_name}"
    else:
        message = hook
    return title, _truncate(message, 500)


def fcm_new_post(board_name: str, post_title: str) -> tuple[str, str]:
    """푸시: 제목은 고정 훅, 본문은 글 제목 중심"""
    title = f"[{APP_NAME}] 새 글이 올라왔어요"
    hook = _truncate(post_title.strip() or "지금 열어보세요", 90)
    if board_name:
        body = f"「{hook}」 {board_name} · 탭해서 읽어보세요"
    else:
        body = f"「{hook}」 탭해서 읽어보세요"
    return title, _truncate(body, 180)


def noti_new_schedule(type_label: str, subject: str) -> tuple[str, str]:
    title = f"[{APP_NAME}] 새 일정이 등록됐어요"
    sub = subject.strip() or "캘린더 일정"
    message = f"{sub} · {type_label}" if type_label else sub
    return title, _truncate(message, 500)


def fcm_new_schedule(type_label: str, subject: str) -> tuple[str, str]:
    title = f"[{APP_NAME}] 캘린더에 새 일정이 있어요"
    sub = _truncate(subject.strip() or "일정", 80)
    if type_label:
        body = f"「{sub}」 ({type_label}) 지금 확인해보세요"
    else:
        body = f"「{sub}」 지금 확인해보세요"
    return title, _truncate(body, 180)


def noti_schedule_alarm(subject: str, timing_label: str) -> tuple[str, str]:
    title = f"[{APP_NAME}] 일정 알림"
    sub = subject.strip() or "일정"
    message = f"{sub} · {timing_label}" if timing_label else sub
    return title, _truncate(message, 500)


def fcm_schedule_alarm(subject: str, timing_label: str) -> tuple[str, str]:
    title = f"[{APP_NAME}] 일정 알림이에요"
    sub = _truncate(subject.strip() or "일정", 70)
    tl = timing_label or "알림"
    body = f"「{sub}」 {tl}입니다. 캘린더에서 확인해요"
    return title, _truncate(body, 180)
