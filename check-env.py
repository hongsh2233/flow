#!/usr/bin/env python3
"""
환경 변수 검증 스크립트

.env.local 파일이 제대로 설정되었는지 확인합니다.
admin 앱이 실행되기 위해 필요한 필수 환경 변수를 검증합니다.
"""
import os
import sys
import re
from pathlib import Path

# 프로젝트 루트 디렉토리
ROOT = Path(__file__).resolve().parent
ENV_LOCAL = ROOT / ".env.local"

print("=" * 60)
print("환경 변수 검증 스크립트")
print("=" * 60)
print()

# .env.local 파일 존재 확인
if not ENV_LOCAL.exists():
    print("❌ .env.local 파일이 없습니다!")
    print(f"   경로: {ENV_LOCAL}")
    print()
    print("💡 해결 방법:")
    print("   1. 루트 디렉토리에 .env.local 파일을 생성하세요")
    print("   2. RUN.md 파일의 예시를 참고하여 환경 변수를 설정하세요")
    sys.exit(1)

print(f"✅ .env.local 파일 발견: {ENV_LOCAL}")
print()

# .env.local 파일 읽기 및 파싱
env_vars = {}
if ENV_LOCAL.exists():
    with open(ENV_LOCAL, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # 주석이나 빈 줄 건너뛰기
            if not line or line.startswith('#'):
                continue
            # KEY=VALUE 형식 파싱
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$', line)
            if match:
                key = match.group(1)
                value = match.group(2).strip()
                # 따옴표 제거
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                env_vars[key] = value

# 환경 변수 설정 (os.getenv가 작동하도록)
for key, value in env_vars.items():
    os.environ[key] = value

# 필수 환경 변수 목록
REQUIRED_VARS = {
    "ADMIN_EMAIL": "초기 관리자 이메일",
    "ADMIN_PW": "초기 관리자 비밀번호",
    "SECRET_TOKEN": "세션 인증 토큰",
    "DB_USER": "데이터베이스 사용자명",
    "DB_PASSWORD": "데이터베이스 비밀번호",
    "DB_HOST": "데이터베이스 호스트",
    "DB_PORT": "데이터베이스 포트",
    "DB_NAME": "데이터베이스 이름",
}

# 선택적 환경 변수 (기본값이 있거나 선택사항)
OPTIONAL_VARS = {
    "DATABASE_URL": "데이터베이스 연결 URL (DB_* 변수 대신 사용 가능)",
    "JWT_SECRET_KEY": "JWT 토큰 암호화 키 (기본값: SECRET_TOKEN 사용)",
    "AUTH_COOKIE_NAME": "인증 쿠키 이름 (기본값: bo_session_id)",
    "DATA_GO_KR_API_KEY": "공공데이터포털 API 인증키 (선택사항)",
    "NEXT_PUBLIC_API_BASE_URL": "백오피스 API 기본 URL",
    "NEXT_PUBLIC_X_API_KEY": "API 인증 키",
}

# 검증 결과
errors = []
warnings = []

print("필수 환경 변수 검증:")
print("-" * 60)

for var, description in REQUIRED_VARS.items():
    value = os.getenv(var)
    if not value:
        errors.append(f"❌ {var}: {description} - 설정되지 않음")
    else:
        # 보안을 위해 비밀번호와 토큰은 일부만 표시
        if "PASSWORD" in var or "TOKEN" in var or "SECRET" in var:
            display_value = f"{value[:4]}..." if len(value) > 4 else "***"
        else:
            display_value = value
        print(f"✅ {var}: {display_value}")

print()

# DATABASE_URL이 있으면 DB_* 변수는 선택사항
if os.getenv("DATABASE_URL"):
    print("✅ DATABASE_URL이 설정되어 있습니다 (DB_* 변수 대신 사용)")
    print()
else:
    print("선택적 환경 변수 검증:")
    print("-" * 60)
    
    for var, description in OPTIONAL_VARS.items():
        value = os.getenv(var)
        if not value:
            if var in ["JWT_SECRET_KEY", "AUTH_COOKIE_NAME"]:
                print(f"⚠️  {var}: {description} - 기본값 사용")
            else:
                warnings.append(f"⚠️  {var}: {description} - 설정되지 않음 (선택사항)")
        else:
            if "PASSWORD" in var or "TOKEN" in var or "SECRET" in var or "KEY" in var:
                display_value = f"{value[:4]}..." if len(value) > 4 else "***"
            else:
                display_value = value
            print(f"✅ {var}: {display_value}")

print()

# 보안 경고
print("보안 검증:")
print("-" * 60)

if os.getenv("SECRET_TOKEN") == "your-secret-token-change-this-in-production":
    warnings.append("⚠️  SECRET_TOKEN이 기본값입니다. 프로덕션에서는 반드시 변경하세요!")

if os.getenv("ADMIN_PW") and len(os.getenv("ADMIN_PW", "")) < 8:
    warnings.append("⚠️  ADMIN_PW가 너무 짧습니다. 최소 8자 이상 권장합니다.")

if os.getenv("DB_PASSWORD") == "postgres_password":
    warnings.append("⚠️  DB_PASSWORD가 기본값입니다. 프로덕션에서는 반드시 변경하세요!")

# 결과 출력
print()
print("=" * 60)
if errors:
    print("❌ 검증 실패: 다음 필수 환경 변수가 설정되지 않았습니다:")
    for error in errors:
        print(f"   {error}")
    print()
    sys.exit(1)
elif warnings:
    print("⚠️  검증 완료 (경고 있음):")
    for warning in warnings:
        print(f"   {warning}")
    print()
    print("✅ admin 앱은 실행 가능하지만, 위 경고 사항을 확인하세요.")
    sys.exit(0)
else:
    print("✅ 모든 필수 환경 변수가 설정되었습니다!")
    print()
    print("다음 단계:")
    print("   1. PostgreSQL 데이터베이스 실행: cd apps/admin && docker-compose up -d")
    print("   2. Admin 서버 실행: cd apps/admin && uvicorn app.main:app --reload --port 8080")
    print()
    sys.exit(0)

