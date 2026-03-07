"""
FCM (Firebase Cloud Messaging) 푸시 알림 서비스

Capacitor APK에서 등록한 FCM 토큰으로 푸시 알림을 전송합니다.

환경 변수 설정:
  FIREBASE_SERVICE_ACCOUNT_JSON  Firebase 서비스 계정 JSON 문자열 (전체 내용)
  또는
  FIREBASE_SERVICE_ACCOUNT_PATH  서비스 계정 JSON 파일 경로

Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성에서 다운로드
"""
import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    """Firebase Admin App 초기화 (1회만)"""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    try:
        import firebase_admin
        from firebase_admin import credentials

        # 이미 초기화된 앱이 있으면 반환
        try:
            _firebase_app = firebase_admin.get_app()
            return _firebase_app
        except ValueError:
            pass

        # 서비스 계정 JSON 로드
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

        if sa_json:
            sa_dict = json.loads(sa_json)
            cred = credentials.Certificate(sa_dict)
        elif sa_path and os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)
        else:
            logger.warning("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_PATH 환경 변수가 설정되지 않았습니다. FCM 비활성화.")
            return None

        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("[FCM] Firebase Admin SDK 초기화 완료")
        return _firebase_app

    except ImportError:
        logger.warning("[FCM] firebase-admin 패키지가 설치되지 않았습니다. (pip install firebase-admin)")
        return None
    except Exception as e:
        logger.error(f"[FCM] Firebase 초기화 실패: {e}")
        return None


async def send_push_to_tokens(
    tokens: list[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """
    FCM 토큰 목록에 푸시 알림 전송

    Args:
        tokens: FCM 토큰 목록
        title: 알림 제목
        body: 알림 내용
        data: 추가 데이터 (link_url 등)

    Returns:
        성공 전송 건수
    """
    if not tokens:
        return 0

    app = _get_firebase_app()
    if app is None:
        return 0

    try:
        from firebase_admin import messaging

        messages = []
        for token in tokens:
            msg = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
                token=token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default",
                    ),
                ),
            )
            messages.append(msg)

        # 최대 500개씩 배치 전송
        success_count = 0
        for i in range(0, len(messages), 500):
            batch = messages[i : i + 500]
            response = messaging.send_each(batch, app=app)
            success_count += response.success_count
            if response.failure_count > 0:
                logger.warning(f"[FCM] 전송 실패 {response.failure_count}건")

        logger.info(f"[FCM] 전송 완료: {success_count}/{len(tokens)}")
        return success_count

    except Exception as e:
        logger.error(f"[FCM] 전송 오류: {e}")
        return 0


async def send_push_to_email(
    db,
    email: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """특정 회원 이메일의 모든 FCM 토큰에 알림 전송"""
    from app.engine.models import MemberFcmToken
    tokens_rows = db.query(MemberFcmToken.token).filter(
        MemberFcmToken.member_email == email
    ).all()
    tokens = [r[0] for r in tokens_rows]
    return await send_push_to_tokens(tokens, title, body, data)


async def send_push_to_all(
    db,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """등록된 모든 FCM 토큰에 알림 전송 (새 게시글/일정 등 전체 알림용)"""
    from app.engine.models import MemberFcmToken
    tokens_rows = db.query(MemberFcmToken.token).all()
    tokens = [r[0] for r in tokens_rows]
    return await send_push_to_tokens(tokens, title, body, data)
