"""
market_morning_ai_summaries 테이블 생성 - 아침 시장 Gemini AI 요약 저장
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'market_morning_ai_summaries'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE market_morning_ai_summaries (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    us_market TEXT,
                    kr_indices TEXT,
                    exchange_rate TEXT,
                    kr_focus TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX ix_market_morning_ai_summaries_date ON market_morning_ai_summaries (date)"))
            db.commit()
            print("✅ market_morning_ai_summaries 테이블 생성 완료")
        else:
            print("ℹ️ market_morning_ai_summaries 테이블 이미 존재")
    finally:
        db.close()
