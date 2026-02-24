"""
member_fcm_tokens 테이블 생성
- 회원 FCM 푸시 토큰 저장 (Capacitor APK용)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'member_fcm_tokens'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE member_fcm_tokens (
                    id SERIAL PRIMARY KEY,
                    member_email VARCHAR(100) NOT NULL,
                    token VARCHAR(500) NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_member_fcm_token UNIQUE (member_email, token)
                )
            """))
            db.execute(text("CREATE INDEX ix_member_fcm_tokens_member_email ON member_fcm_tokens (member_email)"))
            db.commit()
            print("✅ member_fcm_tokens 테이블 생성 완료")
        else:
            print("ℹ️ member_fcm_tokens 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ member_fcm_tokens 마이그레이션 실패: {e}")
    finally:
        db.close()
