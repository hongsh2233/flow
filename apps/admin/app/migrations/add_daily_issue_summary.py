"""
daily_issue_summaries 테이블 생성 - 금일 이슈 Gemini AI 요약
- 20:00 스케줄러가 naver_stock_news 수집 뉴스를 Gemini로 요약 후 저장
- briefing 이슈 탭 상단에 노출
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'daily_issue_summaries'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE daily_issue_summaries (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    summary TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX ix_daily_issue_summaries_date ON daily_issue_summaries (date)"))
            db.commit()
            print("✅ daily_issue_summaries 테이블 생성 완료 (금일 이슈 요약)")
        else:
            print("ℹ️ daily_issue_summaries 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ daily_issue_summaries 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()
