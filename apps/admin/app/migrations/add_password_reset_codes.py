"""
비밀번호 재설정 인증코드 DB 저장 (SECURITY_AUDIT 4, 5번 대응)
- 기존 in-memory dict 대신 DB에 저장하여 서버 재시작/다중 인스턴스 대응
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'password_reset_codes'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE password_reset_codes (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(100) NOT NULL,
                    code VARCHAR(10) NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX ix_password_reset_codes_email ON password_reset_codes (email)"))
            db.execute(text("CREATE INDEX ix_password_reset_codes_expires_at ON password_reset_codes (expires_at)"))
            db.commit()
            print("✅ password_reset_codes 테이블 생성 완료")
        else:
            print("ℹ️ password_reset_codes 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ password_reset_codes 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()
