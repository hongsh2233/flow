"""
로그인 실패 횟수 제한용 테이블 (SECURITY_AUDIT 10번)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'login_attempts'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE login_attempts (
                    id SERIAL PRIMARY KEY,
                    identifier VARCHAR(255) NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    locked_until TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE UNIQUE INDEX ix_login_attempts_identifier ON login_attempts (identifier)"))
            db.commit()
            print("✅ login_attempts 테이블 생성 완료")
        else:
            print("ℹ️ login_attempts 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ login_attempts 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()
