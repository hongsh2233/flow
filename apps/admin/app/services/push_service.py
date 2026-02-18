"""
푸시 알림 서비스 (시황 새 글 알림)

시황(report) 게시판에 새 글이 올라오면 푸시 알림을 보내는 로직.
- 시황 = report 페이지에 표시되는 게시판 (B003 주린이 알림 제외)
- Web Push 구현 시: VAPID 키, push_subscriptions 테이블, pywebpush 필요
"""
import logging

logger = logging.getLogger(__name__)

# 주린이 알림(B003) 제외 = 시황 게시판
SIHWANG_EXCLUDE_BOARD = "B003"


async def maybe_send_push_on_new_post(board_id: str, post_title: str, post_id: int) -> None:
    """
    시황 게시판에 새 글이 올라오면 푸시 전송 시도.
    board_id가 B003이 아닌 경우 시황으로 간주.
    """
    if board_id == SIHWANG_EXCLUDE_BOARD:
        return
    # TODO: Web Push 구현
    # - push_subscriptions에서 푸시 활성화한 사용자 구독 목록 조회
    # - pywebpush로 각 구독에 푸시 전송
    logger.info(
        "[푸시] 시황 새 글 알림 대상: board_id=%s, post_id=%s, title=%s",
        board_id,
        post_id,
        post_title[:50] if post_title else "",
    )
