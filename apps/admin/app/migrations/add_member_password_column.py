"""
회원 테이블에 hashed_password 컬럼 추가 마이그레이션
일반 로그인(이메일/비밀번호) 지원을 위해 필요
"""
from sqlalchemy import text
from app.database import SessionLocal


def run_migration():
    """members 테이블에 hashed_password 컬럼 추가"""
    db = SessionLocal()
    try:
        # members 테이블이 있는지 확인
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'members'
        """))
        has_table = result.fetchone() is not None

        if not has_table:
            print("⚠️ members 테이블이 존재하지 않습니다.")
            return

        # hashed_password 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'members'
            AND column_name = 'hashed_password'
        """))
        has_column = result.fetchone() is not None

        if not has_column:
            print("📝 hashed_password 컬럼 추가 중...")
            db.execute(text("ALTER TABLE members ADD COLUMN hashed_password VARCHAR(255) NULL"))
            db.commit()
            print("✅ hashed_password 컬럼 추가 완료")
        else:
            print("✅ hashed_password 컬럼이 이미 존재합니다")

    except Exception as e:
        print(f"❌ hashed_password 컬럼 마이그레이션 실패: {e}")
        db.rollback()
    finally:
        db.close()
