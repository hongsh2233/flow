"""
Yahoo Finance 지수 저장 테이블 생성 마이그레이션

- yahoo_index_snapshots
- yahoo_index_daily
"""

from sqlalchemy import text
from app.database import SessionLocal


def run_migration(db=None):
    close_after = False
    if db is None:
        db = SessionLocal()
        close_after = True

    try:
        # PostgreSQL 기준 DDL (SQLite 등에서도 최대한 동작하도록 IF NOT EXISTS 사용)
        db.execute(text("""
        CREATE TABLE IF NOT EXISTS yahoo_index_snapshots (
            id SERIAL PRIMARY KEY,
            "group" VARCHAR(10) NOT NULL,
            symbol VARCHAR(30) NOT NULL,
            name VARCHAR(50) NOT NULL,
            market VARCHAR(10),
            currency VARCHAR(10),
            price DOUBLE PRECISION,
            change DOUBLE PRECISION,
            change_percent DOUBLE PRECISION,
            regular_market_time INTEGER,
            collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            collected_date DATE NOT NULL,
            collected_time VARCHAR(5) NOT NULL
        );
        """))

        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_snapshots_group ON yahoo_index_snapshots(\"group\");"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_snapshots_symbol ON yahoo_index_snapshots(symbol);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_snapshots_collected_date ON yahoo_index_snapshots(collected_date);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_snapshots_collected_at ON yahoo_index_snapshots(collected_at);"))

        db.execute(text("""
        CREATE TABLE IF NOT EXISTS yahoo_index_daily (
            id SERIAL PRIMARY KEY,
            date DATE NOT NULL,
            "group" VARCHAR(10) NOT NULL,
            symbol VARCHAR(30) NOT NULL,
            name VARCHAR(50) NOT NULL,
            market VARCHAR(10),
            currency VARCHAR(10),
            price DOUBLE PRECISION,
            change DOUBLE PRECISION,
            change_percent DOUBLE PRECISION,
            last_collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_collected_time VARCHAR(5) NOT NULL,
            CONSTRAINT uq_yahoo_index_daily UNIQUE (date, "group", symbol)
        );
        """))

        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_daily_date ON yahoo_index_daily(date);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_daily_group ON yahoo_index_daily(\"group\");"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_yahoo_index_daily_symbol ON yahoo_index_daily(symbol);"))

        db.commit()
        print("✅ yahoo_index_snapshots / yahoo_index_daily 테이블 마이그레이션 완료")
    except Exception as e:
        db.rollback()
        print(f"❌ Yahoo 지수 테이블 마이그레이션 실패: {e}")
        raise
    finally:
        if close_after:
            db.close()


