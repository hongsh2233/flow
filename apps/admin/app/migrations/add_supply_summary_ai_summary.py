"""
supply_summary_ai_summaries 테이블 생성 - 수급 동향 Gemini AI 요약 (30분 스케줄)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'supply_summary_ai_summaries'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE supply_summary_ai_summaries (
                    id SERIAL PRIMARY KEY,
                    bizdate VARCHAR(8) NOT NULL,
                    collected_time VARCHAR(5) NOT NULL,
                    ai_summary TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_supply_summary_ai UNIQUE (bizdate, collected_time)
                )
            """))
            db.execute(text("CREATE INDEX ix_supply_summary_ai_summaries_bizdate ON supply_summary_ai_summaries (bizdate)"))
            db.execute(text("CREATE INDEX ix_supply_summary_ai_summaries_collected_time ON supply_summary_ai_summaries (collected_time)"))
            db.commit()
            print("✅ supply_summary_ai_summaries 테이블 생성 완료")
        else:
            print("ℹ️ supply_summary_ai_summaries 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ supply_summary_ai_summaries 마이그레이션 실패: {e}")
    finally:
        db.close()
