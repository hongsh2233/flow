"""
배너 테이블에 position 컬럼 추가 (상단/하단 위치 구분)
- 기본값: 'top' (기존 배너는 모두 상단으로 유지)
- ADD COLUMN IF NOT EXISTS 사용: 이미 컬럼이 있어도 에러 없이 통과
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE banners ADD COLUMN IF NOT EXISTS position VARCHAR(20) DEFAULT 'top'"
        ))
        db.commit()
        print("✅ banners.position 컬럼 마이그레이션 완료")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
