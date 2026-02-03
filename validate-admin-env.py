#!/usr/bin/env python3
"""
Admin 앱 환경 변수 검증 스크립트

admin 앱의 config.py와 database.py를 직접 import하여
필수 환경 변수가 제대로 설정되었는지 확인합니다.
"""
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
ROOT = Path(__file__).resolve().parent
ADMIN_DIR = ROOT / "apps" / "admin"
sys.path.insert(0, str(ADMIN_DIR))

print("=" * 60)
print("Admin 앱 환경 변수 검증")
print("=" * 60)
print()

try:
    # admin 앱의 config와 database 모듈 import
    # 이 과정에서 .env.local이 자동으로 로드됩니다
    from app import config
    from app.engine import database
    
    print("✅ Admin 앱 모듈 로드 성공")
    print()
    
    # 필수 환경 변수 검증
    errors = []
    warnings = []
    
    print("필수 환경 변수 검증:")
    print("-" * 60)
    
    # 1. 관리자 계정 설정
    if not config.ADMIN_EMAIL:
        errors.append("❌ ADMIN_EMAIL: 초기 관리자 이메일이 설정되지 않았습니다")
    else:
        print(f"✅ ADMIN_EMAIL: {config.ADMIN_EMAIL}")
    
    if not config.ADMIN_PW:
        errors.append("❌ ADMIN_PW: 초기 관리자 비밀번호가 설정되지 않았습니다")
    else:
        if len(config.ADMIN_PW) < 8:
            warnings.append("⚠️  ADMIN_PW: 비밀번호가 너무 짧습니다 (최소 8자 권장)")
        print(f"✅ ADMIN_PW: {'*' * len(config.ADMIN_PW)}")
    
    # 2. 인증 토큰
    if not config.SECRET_TOKEN:
        errors.append("❌ SECRET_TOKEN: 세션 인증 토큰이 설정되지 않았습니다")
    else:
        if config.SECRET_TOKEN == "your-secret-token-change-this-in-production":
            warnings.append("⚠️  SECRET_TOKEN: 기본값입니다. 프로덕션에서는 변경하세요")
        print(f"✅ SECRET_TOKEN: {config.SECRET_TOKEN[:10]}...")
    
    # 3. 데이터베이스 설정
    print()
    print("데이터베이스 설정 검증:")
    print("-" * 60)
    
    db_url = database.SQLALCHEMY_DATABASE_URL
    if "DATABASE_URL" in db_url or database.DB_PASSWORD:
        if database.DB_HOST:
            print(f"✅ DB_HOST: {database.DB_HOST}")
        if database.DB_PORT:
            print(f"✅ DB_PORT: {database.DB_PORT}")
        if database.DB_NAME:
            print(f"✅ DB_NAME: {database.DB_NAME}")
        if database.DB_USER:
            print(f"✅ DB_USER: {database.DB_USER}")
        if database.DB_PASSWORD:
            if database.DB_PASSWORD == "postgres_password":
                warnings.append("⚠️  DB_PASSWORD: 기본값입니다. 프로덕션에서는 변경하세요")
            print(f"✅ DB_PASSWORD: {'*' * len(database.DB_PASSWORD)}")
        
        # DATABASE_URL 확인
        if "DATABASE_URL" in str(db_url) or db_url.startswith("postgresql"):
            print(f"✅ DATABASE_URL: 설정됨")
        else:
            errors.append("❌ 데이터베이스 연결 URL이 올바르지 않습니다")
    else:
        errors.append("❌ 데이터베이스 설정이 완료되지 않았습니다 (DB_* 변수 또는 DATABASE_URL 필요)")
    
    # 4. 선택적 환경 변수
    print()
    print("선택적 환경 변수:")
    print("-" * 60)
    
    if config.DATA_GO_KR_API_KEY:
        print(f"✅ DATA_GO_KR_API_KEY: 설정됨")
    else:
        print("⚠️  DATA_GO_KR_API_KEY: 설정되지 않음 (공공데이터포털 API 사용 시 필요)")
    
    if config.JWT_SECRET_KEY and config.JWT_SECRET_KEY != config.SECRET_TOKEN:
        print(f"✅ JWT_SECRET_KEY: 설정됨")
    else:
        print("ℹ️  JWT_SECRET_KEY: SECRET_TOKEN 사용 (기본값)")
    
    # 결과 출력
    print()
    print("=" * 60)
    
    if errors:
        print("❌ 검증 실패: 다음 필수 환경 변수가 설정되지 않았습니다:")
        print()
        for error in errors:
            print(f"   {error}")
        print()
        print("💡 해결 방법:")
        print("   1. 루트 디렉토리에 .env.local 파일이 있는지 확인하세요")
        print("   2. ENV_SETUP.md 파일을 참고하여 필수 환경 변수를 설정하세요")
        print()
        sys.exit(1)
    elif warnings:
        print("⚠️  검증 완료 (경고 있음):")
        print()
        for warning in warnings:
            print(f"   {warning}")
        print()
        print("✅ Admin 앱은 실행 가능하지만, 위 경고 사항을 확인하세요.")
        print()
        sys.exit(0)
    else:
        print("✅ 모든 필수 환경 변수가 올바르게 설정되었습니다!")
        print()
        print("다음 단계:")
        print("   1. PostgreSQL 데이터베이스 실행:")
        print("      cd apps/admin && docker-compose up -d")
        print()
        print("   2. Admin 서버 실행:")
        print("      cd apps/admin")
        print("      source venv/bin/activate  # 또는 .\\venv\\Scripts\\activate (Windows)")
        print("      uvicorn app.main:app --reload --port 8080")
        print()
        print("   3. 브라우저에서 확인:")
        print("      - Admin UI: http://localhost:8080")
        print("      - API 문서: http://localhost:8080/docs")
        print()
        sys.exit(0)
        
except ImportError as e:
    print(f"❌ Admin 앱 모듈을 로드할 수 없습니다: {e}")
    print()
    print("💡 해결 방법:")
    print("   1. apps/admin 디렉토리로 이동하여 가상환경을 활성화하세요")
    print("   2. 필요한 패키지를 설치하세요: pip install -r requirements.txt")
    print()
    sys.exit(1)
except Exception as e:
    print(f"❌ 오류 발생: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

