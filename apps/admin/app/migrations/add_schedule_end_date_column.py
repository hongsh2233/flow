"""
일정 테이블에 end_date 컬럼 추가 (기간 일정 지원)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    """schedules 테이블에 end_date 컬럼 추가"""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'schedules'
            AND column_name = 'end_date'
        """))
        if result.fetchone() is None:
            print("📝 schedules.end_date 컬럼 추가 중...")
            db.execute(text("ALTER TABLE schedules ADD COLUMN end_date DATE"))
            print("✅ schedules.end_date 컬럼 추가 완료")
        else:
            print("ℹ️ schedules.end_date 컬럼이 이미 존재합니다.")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
