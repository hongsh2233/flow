"""
환율 스냅샷 테이블 생성 마이그레이션
- 30분마다 Yahoo Finance에서 수집한 환율 저장
"""

from sqlalchemy import text
from app.database import SessionLocal


def run_migration(db=None):
    close_after = False
    if db is None:
        db = SessionLocal()
        close_after = True

    try:
        db.execute(text("""
        CREATE TABLE IF NOT EXISTS exchange_rate_snapshots (
            id SERIAL PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            currency VARCHAR(10) NOT NULL,
            rate DOUBLE PRECISION NOT NULL,
            change_val DOUBLE PRECISION NOT NULL,
            collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            collected_date DATE NOT NULL,
            collected_time VARCHAR(5) NOT NULL
        );
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_exchange_rate_collected_at ON exchange_rate_snapshots(collected_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_exchange_rate_collected_date ON exchange_rate_snapshots(collected_date);"))
        db.commit()
        print("✅ exchange_rate_snapshots 테이블 마이그레이션 완료")
    except Exception as e:
        db.rollback()
        print(f"❌ 환율 스냅샷 테이블 마이그레이션 실패: {e}")
        raise
    finally:
        if close_after:
            db.close()
