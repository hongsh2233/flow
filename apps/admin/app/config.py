"""
애플리케이션 설정

이 모듈은 환경 변수에서 애플리케이션 설정을 로드합니다.
.env 파일에 다음 변수들을 설정해야 합니다.

필수 환경 변수:
    ADMIN_EMAIL: 초기 관리자 이메일
    ADMIN_PW: 초기 관리자 비밀번호
    SECRET_TOKEN: 세션 인증 토큰
    DB_USER: 데이터베이스 사용자명
    DB_PASSWORD: 데이터베이스 비밀번호
    DB_HOST: 데이터베이스 호스트
    DB_PORT: 데이터베이스 포트
    DB_NAME: 데이터베이스 이름

선택적 환경 변수:
    AUTH_COOKIE_NAME: 인증 쿠키 이름 (기본값: 'bo_session_id')
    JWT_SECRET_KEY: JWT 토큰 암호화 키 (기본값: SECRET_TOKEN 또는 기본값)
    DATA_GO_KR_API_KEY: 공공데이터포털 API 인증키
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 디렉토리: admin (BASE_DIR), 모노레포 루트 (ROOT)
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT = BASE_DIR.parent.parent  # jurin-i 루트
ENV_LOCAL_ROOT = ROOT / ".env.local"
ENV_FILE = BASE_DIR / ".env"

# 1) 루트 .env.local 먼저 로드 (web + admin 공용)
if ENV_LOCAL_ROOT.exists():
    load_dotenv(dotenv_path=ENV_LOCAL_ROOT)
    print(f".env.local 로드 완료 (루트): {ENV_LOCAL_ROOT}")
# 2) admin/.env 있으면 로드 (admin 전용, 루트에 없는 값 보충)
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
    print(f".env 로드 완료 (admin): {ENV_FILE}")
if not ENV_LOCAL_ROOT.exists() and not ENV_FILE.exists():
    load_dotenv()
    print("경고: .env.local(루트) 또는 .env(admin) 없음. 기본 위치에서 시도합니다.")

# 관리자 계정 설정
# 기본값: 환경 변수가 없으면 init_admin_user()와 동일한 기본 이메일 사용
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "hongsh220303@gmail.com")  # 초기 관리자 이메일
ADMIN_PW = os.environ.get("ADMIN_PW")  # 초기 관리자 비밀번호

# 인증 설정
AUTH_COOKIE_NAME = os.environ.get("AUTH_COOKIE_NAME", "bo_session_id")  # 인증 쿠키 이름
SECRET_TOKEN = os.environ.get("SECRET_TOKEN")  # 세션 인증 토큰

# SECRET_TOKEN이 없으면 경고 출력 및 고정 기본값 설정 (개발 환경용)
# 주의: 프로덕션에서는 반드시 .env.local에 SECRET_TOKEN을 설정하세요!
if not SECRET_TOKEN:
    # 개발 환경용 고정 토큰 (서버 재시작 시에도 동일하게 유지)
    SECRET_TOKEN = "dev-secret-token-change-in-production-12345"
    print("⚠️ 경고: SECRET_TOKEN이 설정되지 않았습니다. 개발용 기본 토큰을 사용합니다.")
    print("💡 프로덕션 환경에서는 반드시 .env.local에 SECRET_TOKEN을 설정하세요.")
    print(f"   예: SECRET_TOKEN=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')")

# JWT 설정 (REST API 인증용)
JWT_SECRET_KEY = os.environ.get(
    "JWT_SECRET_KEY",
    SECRET_TOKEN or "your-secret-key-change-in-production"
)  # JWT 토큰 암호화 키
JWT_ALGORITHM = "HS256"  # JWT 알고리즘
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 1  # Access Token 만료 시간 (1시간) - 짧게 설정하여 보안 강화
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30  # Refresh Token 만료 시간 (30일) - 긴 기간으로 설정

# 공공데이터포털 API 설정
DATA_GO_KR_API_KEY = os.environ.get("DATA_GO_KR_API_KEY")  # 공공데이터포털 API 인증키


# 디버깅: API 키 로드 확인 (서버 시작 시 한 번만 출력)
# 보안: API 키 미리보기는 콘솔에 출력하지 않음
if DATA_GO_KR_API_KEY:
    print(f"DATA_GO_KR_API_KEY 로드됨 (길이: {len(DATA_GO_KR_API_KEY)}자)")
else:
    print("경고: DATA_GO_KR_API_KEY가 설정되지 않았습니다.")

