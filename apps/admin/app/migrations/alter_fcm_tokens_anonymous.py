"""
member_fcm_tokens 테이블 수정 - 비로그인 디바이스 토큰 지원
- member_email: NOT NULL → NULL 허용
- UniqueConstraint: (member_email, token) → (token) 단독
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # 1. member_email nullable로 변경 (이미 nullable이면 no-op)
        db.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'member_fcm_tokens'
                      AND column_name = 'member_email'
                      AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE member_fcm_tokens
                    ALTER COLUMN member_email DROP NOT NULL;
                END IF;
            END $$;
        """))

        # 2. 기존 unique constraint 제거
        db.execute(text("""
            ALTER TABLE member_fcm_tokens
            DROP CONSTRAINT IF EXISTS uq_member_fcm_token
        """))

        # 3. token 단독 unique constraint 추가 (이미 존재하면 스킵)
        db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'uq_fcm_token'
                      AND conrelid = 'member_fcm_tokens'::regclass
                ) THEN
                    ALTER TABLE member_fcm_tokens
                    ADD CONSTRAINT uq_fcm_token UNIQUE (token);
                END IF;
            END $$;
        """))

        db.commit()
        print("✅ member_fcm_tokens 마이그레이션 완료: 비로그인 토큰 지원")
    except Exception as e:
        db.rollback()
        print(f"❌ member_fcm_tokens 마이그레이션 실패: {e}")
    finally:
        db.close()
