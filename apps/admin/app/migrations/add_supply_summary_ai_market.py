"""
supply_summary_ai_summaries 에 market 컬럼 추가 (kospi / kosdaq / all)
UNIQUE (bizdate, collected_time) → (bizdate, collected_time, market)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(
            text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'supply_summary_ai_summaries'
        """)
        )
        if r.fetchone() is None:
            print("ℹ️ supply_summary_ai_summaries 없음 — add_supply_summary_ai_summary 먼저 실행")
            return

        col = db.execute(
            text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'supply_summary_ai_summaries'
              AND column_name = 'market'
        """)
        )
        if col.fetchone() is None:
            db.execute(
                text("""
                ALTER TABLE supply_summary_ai_summaries
                ADD COLUMN market VARCHAR(16) NOT NULL DEFAULT 'all'
            """)
            )
            print("✅ supply_summary_ai_summaries.market 컬럼 추가")
        else:
            print("ℹ️ supply_summary_ai_summaries.market 이미 존재")

        db.execute(text("ALTER TABLE supply_summary_ai_summaries DROP CONSTRAINT IF EXISTS uq_supply_summary_ai"))
        db.execute(
            text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'uq_supply_summary_ai_bizdate_time_market'
                ) THEN
                    ALTER TABLE supply_summary_ai_summaries
                    ADD CONSTRAINT uq_supply_summary_ai_bizdate_time_market
                    UNIQUE (bizdate, collected_time, market);
                END IF;
            END $$;
        """)
        )
        db.execute(
            text("""
            CREATE INDEX IF NOT EXISTS ix_supply_summary_ai_summaries_market
            ON supply_summary_ai_summaries (market)
        """)
        )
        db.commit()
        print("✅ supply_summary_ai UNIQUE(bizdate, collected_time, market) 적용")
    except Exception as e:
        db.rollback()
        print(f"❌ supply_summary_ai market 마이그레이션 실패: {e}")
    finally:
        db.close()
