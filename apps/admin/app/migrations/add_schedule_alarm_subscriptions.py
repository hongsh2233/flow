"""
schedule_alarm_subscriptions 테이블 생성
- 회원별 일정 알림 신청 내역 저장
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'schedule_alarm_subscriptions'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE schedule_alarm_subscriptions (
                    id SERIAL PRIMARY KEY,
                    member_email VARCHAR(100) NOT NULL,
                    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
                    timing VARCHAR(10) NOT NULL DEFAULT '1day',
                    notified VARCHAR(10) NOT NULL DEFAULT 'false',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_schedule_alarm_sub UNIQUE (member_email, schedule_id)
                )
            """))
            db.execute(text("CREATE INDEX ix_schedule_alarm_subscriptions_member_email ON schedule_alarm_subscriptions (member_email)"))
            db.execute(text("CREATE INDEX ix_schedule_alarm_subscriptions_schedule_id ON schedule_alarm_subscriptions (schedule_id)"))
            db.commit()
            print("✅ schedule_alarm_subscriptions 테이블 생성 완료")
        else:
            print("ℹ️ schedule_alarm_subscriptions 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ schedule_alarm_subscriptions 마이그레이션 실패: {e}")
    finally:
        db.close()
