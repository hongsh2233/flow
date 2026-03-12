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
_firebase_init_failed = False  # 초기화 실패 시 무한 재시도 방지


def _get_firebase_app():
    """Firebase Admin App 초기화 (1회만)"""
    global _firebase_app, _firebase_init_failed
    if _firebase_app is not None:
        return _firebase_app
    if _firebase_init_failed:
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials

        # 이미 초기화된 앱이 있으면 반환
        try:
            _firebase_app = firebase_admin.get_app()
            return _firebase_app
        except ValueError:
            pass

        # 서비스 계정 JSON 로드 (3가지 방식 지원)
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

        if sa_json:
            # 방식 1: 전체 JSON 문자열
            sa_dict = json.loads(sa_json)
            cred = credentials.Certificate(sa_dict)
        elif sa_path and os.path.exists(sa_path):
            # 방식 2: JSON 파일 경로
            cred = credentials.Certificate(sa_path)
        elif os.getenv("FIREBASE_PROJECT_ID"):
            # 방식 3: Railway 개별 환경변수로 조합
            private_key = os.getenv("FIREBASE_PRIVATE_KEY", "")
            # Railway에서 \n이 리터럴 문자열로 저장되는 경우 처리
            if "\\n" in private_key:
                private_key = private_key.replace("\\n", "\n")
            sa_dict = {
                "type": os.getenv("FIREBASE_TYPE", "service_account"),
                "project_id": os.getenv("FIREBASE_PROJECT_ID"),
                "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
                "private_key": private_key,
                "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
                "client_id": os.getenv("FIREBASE_CLIENT_ID"),
                "auth_uri": os.getenv("FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
                "token_uri": os.getenv("FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
                "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"),
                "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
                "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN", "googleapis.com"),
            }
            cred = credentials.Certificate(sa_dict)
        else:
            logger.warning("[FCM] Firebase 인증 정보가 설정되지 않았습니다. FCM 비활성화.\n"
                           "  방식 1: FIREBASE_SERVICE_ACCOUNT_JSON (전체 JSON 문자열)\n"
                           "  방식 2: FIREBASE_SERVICE_ACCOUNT_PATH (JSON 파일 경로)\n"
                           "  방식 3: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 등 개별 환경변수")
            return None

        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("[FCM] Firebase Admin SDK 초기화 완료")
        return _firebase_app

    except ImportError:
        logger.warning("[FCM] firebase-admin 패키지가 설치되지 않았습니다. (pip install firebase-admin)")
        _firebase_init_failed = True
        return None
    except Exception as e:
        logger.error(f"[FCM] Firebase 초기화 실패: {e}", exc_info=True)
        _firebase_init_failed = True
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
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound="default",
                        )
                    )
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
    if not tokens:
        logger.warning("[FCM] 등록된 FCM 토큰이 없습니다. (member_fcm_tokens 테이블 비어있음)")
        return 0
    logger.info(f"[FCM] 전체 알림 전송 시작: {len(tokens)}개 토큰")
    return await send_push_to_tokens(tokens, title, body, data)
