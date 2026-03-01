"""
배너 테이블에 position 컬럼 추가 (상단/하단 위치 구분)
- 기본값: 'top' (기존 배너는 모두 상단으로 유지)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'position'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN position VARCHAR(20) DEFAULT 'top'"))
            db.commit()
            print("✅ banners.position 컬럼 추가 완료")
        else:
            print("ℹ️ banners.position 컬럼 이미 존재")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
