"""
일정 테이블에 link_url, underwriter 컬럼 추가 (없을 경우만)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    """schedules 테이블에 link_url, underwriter 컬럼 추가"""
    db = SessionLocal()
    try:
        for col, col_type in [("link_url", "VARCHAR(500)"), ("underwriter", "VARCHAR(200)")]:
            result = db.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'schedules'
                AND column_name = :name
            """), {"name": col})
            if result.fetchone() is None:
                print(f"📝 schedules.{col} 컬럼 추가 중...")
                db.execute(text(f"ALTER TABLE schedules ADD COLUMN {col} {col_type}"))
                print(f"✅ schedules.{col} 컬럼 추가 완료")
            else:
                print(f"ℹ️ schedules.{col} 컬럼이 이미 존재합니다.")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
