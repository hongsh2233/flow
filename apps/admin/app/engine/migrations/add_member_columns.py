"""
회원 테이블에 nickname, profile_image 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import engine, SessionLocal


def migrate_member_table():
    """members 테이블 마이그레이션 실행"""
    db = SessionLocal()
    try:
        # 1. members 테이블이 있는지 확인
        result = db.execute(text("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'members'
        """))
        has_table = result.fetchone() is not None
        
        if not has_table:
            print("⚠️ members 테이블이 존재하지 않습니다. 서버 재시작 시 자동으로 생성됩니다.")
            return
        
        # 2. nickname 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'members' 
            AND COLUMN_NAME = 'nickname'
        """))
        has_nickname = result.fetchone() is not None
        
        # 3. profile_image 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'members' 
            AND COLUMN_NAME = 'profile_image'
        """))
        has_profile_image = result.fetchone() is not None
        
        # 4. nickname 컬럼이 없으면 추가
        if not has_nickname:
            print("📝 nickname 컬럼 추가 중...")
            db.execute(text("ALTER TABLE members ADD COLUMN nickname VARCHAR(50) NULL AFTER name"))
            db.commit()
            print("✅ nickname 컬럼 추가 완료")
        
        # 5. profile_image 컬럼이 없으면 추가
        if not has_profile_image:
            print("📝 profile_image 컬럼 추가 중...")
            db.execute(text("ALTER TABLE members ADD COLUMN profile_image VARCHAR(500) NULL AFTER nickname"))
            db.commit()
            print("✅ profile_image 컬럼 추가 완료")
        
        if has_nickname and has_profile_image:
            print("✅ members 테이블 마이그레이션 완료 (모든 컬럼이 이미 존재합니다)")
        
    except Exception as e:
        print(f"❌ members 테이블 마이그레이션 실패: {e}")
        db.rollback()
    finally:
        db.close()

