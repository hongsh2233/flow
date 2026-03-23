"""
market_morning_ai_summaries 테이블에 overnight_issues, today_schedule 컬럼 추가
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # overnight_issues 컬럼
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'market_morning_ai_summaries'
              AND column_name = 'overnight_issues'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE market_morning_ai_summaries ADD COLUMN overnight_issues TEXT"))
            db.commit()
            print("✅ market_morning_ai_summaries.overnight_issues 컬럼 추가 완료")
        else:
            print("ℹ️ overnight_issues 컬럼 이미 존재")

        # today_schedule 컬럼
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'market_morning_ai_summaries'
              AND column_name = 'today_schedule'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE market_morning_ai_summaries ADD COLUMN today_schedule TEXT"))
            db.commit()
            print("✅ market_morning_ai_summaries.today_schedule 컬럼 추가 완료")
        else:
            print("ℹ️ today_schedule 컬럼 이미 존재")
    finally:
        db.close()
