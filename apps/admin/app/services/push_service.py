"""
푸시 알림 서비스 (레거시)

FCM 푸시 알림은 fcm_service.py로 통합되었습니다.
- 새 게시글 알림: board.py → fcm_service.send_push_to_all()
- 새 일정 알림: schedule.py → fcm_service.send_push_to_all()
- 일정 알림 신청: scheduler_service.py → fcm_service.send_push_to_email()
"""
