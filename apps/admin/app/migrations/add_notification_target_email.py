"""
notifications 테이블에 target_email 컬럼 추가
- 개인 알림 (is_global='false') 시 대상 회원 이메일 지정용
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # target_email 컬럼 존재 여부 확인
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'notifications'
              AND column_name = 'target_email'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                ALTER TABLE notifications
                ADD COLUMN target_email VARCHAR(100) NULL
            """))
            db.execute(text(
                "CREATE INDEX ix_notifications_target_email ON notifications (target_email)"
            ))
            db.commit()
            print("✅ notifications.target_email 컬럼 추가 완료")
        else:
            print("ℹ️ notifications.target_email 컬럼 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ notifications.target_email 마이그레이션 실패: {e}")
    finally:
        db.close()
