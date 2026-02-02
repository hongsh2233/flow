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

# 프로젝트 루트 디렉토리 찾기 (app 디렉토리의 부모)
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

# .env 파일 로드 (명시적 경로 지정)
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
    print(f".env 파일 로드 완료: {ENV_FILE}")
else:
    # .env 파일이 없으면 기본 위치에서 시도
    load_dotenv()
    print(f".env 파일을 찾을 수 없습니다. 기본 위치에서 시도합니다.")

# 관리자 계정 설정
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")  # 초기 관리자 이메일
ADMIN_PW = os.environ.get("ADMIN_PW")  # 초기 관리자 비밀번호

# 인증 설정
AUTH_COOKIE_NAME = os.environ.get("AUTH_COOKIE_NAME", "bo_session_id")  # 인증 쿠키 이름
SECRET_TOKEN = os.environ.get("SECRET_TOKEN")  # 세션 인증 토큰

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

