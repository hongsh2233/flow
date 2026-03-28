"""네이버 국내지수 스냅샷 테이블 (domestic_index_snapshots). 보관 일수는 앱(domestic_index_service.KEEP_DAYS)에서 관리."""

from sqlalchemy import text
from app.database import SessionLocal


def run_migration(db=None):
    close_after = False
    if db is None:
        db = SessionLocal()
        close_after = True

    try:
        db.execute(
            text(
                """
        CREATE TABLE IF NOT EXISTS domestic_index_snapshots (
            id SERIAL PRIMARY KEY,
            index_code VARCHAR(20) NOT NULL,
            name VARCHAR(50) NOT NULL,
            price DOUBLE PRECISION,
            change DOUBLE PRECISION,
            change_percent DOUBLE PRECISION,
            local_traded_at VARCHAR(50),
            collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            collected_date DATE NOT NULL,
            collected_time VARCHAR(5) NOT NULL
        );
        """
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_domestic_index_snapshots_collected_at "
                "ON domestic_index_snapshots(collected_at);"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_domestic_index_snapshots_collected_date "
                "ON domestic_index_snapshots(collected_date);"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_domestic_index_snapshots_index_code "
                "ON domestic_index_snapshots(index_code);"
            )
        )
        db.commit()
        print("✅ domestic_index_snapshots 테이블 마이그레이션 완료")
    except Exception as e:
        db.rollback()
        print(f"❌ domestic_index_snapshots 마이그레이션 실패: {e}")
        raise
    finally:
        if close_after:
            db.close()
