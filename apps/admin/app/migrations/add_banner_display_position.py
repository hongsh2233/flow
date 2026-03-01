"""
배너 테이블에 display_position 컬럼 추가 (top | bottom)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'display_position'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN display_position VARCHAR(20) DEFAULT 'bottom'"))
            db.commit()
        print("✅ display_position 컬럼 마이그레이션 완료")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
