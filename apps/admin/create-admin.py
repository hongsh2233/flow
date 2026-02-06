#!/usr/bin/env python3
"""
Railway 배포 후 관리자 계정 수동 생성 스크립트

사용법:
    python create-admin.py <email> <password>

예시:
    python create-admin.py admin@example.com mypassword123
"""
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.database import SessionLocal
from app import models
from app import utils
from app.config import ADMIN_EMAIL, ADMIN_PW

def create_admin_user(email: str, password: str):
    """관리자 계정 생성"""
    db = SessionLocal()
    try:
        # 이미 존재하는지 확인
        existing_user = db.query(models.AdminUser).filter(
            models.AdminUser.email == email
        ).first()
        
        if existing_user:
            print(f"❌ 이미 존재하는 관리자 이메일입니다: {email}")
            return False
        
        # 새 관리자 생성
        hashed_pw = utils.get_password_hash(password)
        new_admin = models.AdminUser(
            email=email,
            name="최고관리자",
            hashed_password=hashed_pw
        )
        db.add(new_admin)
        db.commit()
        
        print(f"✅ 관리자 계정 생성 완료!")
        print(f"   이메일: {email}")
        print(f"   이름: 최고관리자")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ 관리자 계정 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

def main():
    """메인 함수"""
    print("=" * 60)
    print("관리자 계정 생성 스크립트")
    print("=" * 60)
    print()
    
    # 명령줄 인자 확인
    if len(sys.argv) >= 3:
        email = sys.argv[1]
        password = sys.argv[2]
    else:
        # 환경 변수에서 가져오기
        if ADMIN_EMAIL and ADMIN_PW:
            email = ADMIN_EMAIL
            password = ADMIN_PW
            print(f"환경 변수에서 관리자 정보를 가져옵니다:")
            print(f"  ADMIN_EMAIL: {email}")
            print(f"  ADMIN_PW: {'*' * len(password)}")
            print()
        else:
            print("사용법:")
            print("  python create-admin.py <email> <password>")
            print()
            print("또는 환경 변수에 ADMIN_EMAIL과 ADMIN_PW를 설정하세요.")
            sys.exit(1)
    
    # 이메일 형식 검증
    if "@" not in email:
        print("❌ 올바른 이메일 형식이 아닙니다.")
        sys.exit(1)
    
    # 비밀번호 길이 검증
    if len(password) < 8:
        print("⚠️  경고: 비밀번호가 너무 짧습니다 (최소 8자 권장)")
        response = input("계속하시겠습니까? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # 관리자 계정 생성
    success = create_admin_user(email, password)
    
    if success:
        print()
        print("다음 단계:")
        print(f"  1. Admin 로그인 페이지 접속")
        print(f"  2. 이메일: {email}")
        print(f"  3. 비밀번호: (설정한 비밀번호)")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

