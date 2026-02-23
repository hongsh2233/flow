"""
회원 테이블에 등급(grade, grade_expires_at) 컬럼 추가 마이그레이션
- grade: 'regular' | 'vip' | 'family' (기본값 'regular')
- grade_expires_at: 등급 만료일시 (NULL = 무기한)
"""
from sqlalchemy import text
from app.database import engine, SessionLocal


def upgrade():
    """members 테이블에 grade 관련 컬럼 추가"""
    db = SessionLocal()
    try:
        # members 테이블 존재 확인
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'members'
        """))
        if result.fetchone() is None:
            print("⚠️ members 테이블이 존재하지 않습니다. 서버 재시작 시 자동으로 생성됩니다.")
            return

        # grade 컬럼 존재 확인
        result = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'grade'
        """))
        has_grade = result.fetchone() is not None

        # grade_expires_at 컬럼 존재 확인
        result = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'grade_expires_at'
        """))
        has_expires = result.fetchone() is not None

        if not has_grade:
            print("📝 grade 컬럼 추가 중...")
            db.execute(text("ALTER TABLE members ADD COLUMN grade VARCHAR(20) NOT NULL DEFAULT 'regular'"))
            db.commit()
            print("✅ grade 컬럼 추가 완료")

        if not has_expires:
            print("📝 grade_expires_at 컬럼 추가 중...")
            db.execute(text("ALTER TABLE members ADD COLUMN grade_expires_at TIMESTAMP WITH TIME ZONE NULL"))
            db.commit()
            print("✅ grade_expires_at 컬럼 추가 완료")

        if has_grade and has_expires:
            print("✅ 회원 등급 컬럼 마이그레이션 완료 (이미 존재)")

    except Exception as e:
        print(f"❌ 회원 등급 컬럼 마이그레이션 실패: {e}")
        db.rollback()
    finally:
        db.close()
