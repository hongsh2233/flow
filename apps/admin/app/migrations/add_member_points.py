"""
members.point_balance, last_daily_login_bonus_date 및 member_point_ledgers 테이블
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        db.execute(text("""
            ALTER TABLE members
            ADD COLUMN IF NOT EXISTS point_balance INTEGER NOT NULL DEFAULT 0
        """))
        db.execute(text("""
            ALTER TABLE members
            ADD COLUMN IF NOT EXISTS last_daily_login_bonus_date DATE NULL
        """))
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'member_point_ledgers'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE member_point_ledgers (
                    id SERIAL PRIMARY KEY,
                    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                    delta INTEGER NOT NULL,
                    balance_after INTEGER NOT NULL,
                    reason VARCHAR(64) NOT NULL,
                    ref_type VARCHAR(32) NULL,
                    ref_id VARCHAR(64) NULL,
                    idempotency_key VARCHAR(128) NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text(
                "CREATE INDEX ix_member_point_ledgers_member_id ON member_point_ledgers (member_id)"
            ))
            db.execute(text(
                "CREATE INDEX ix_member_point_ledgers_reason ON member_point_ledgers (reason)"
            ))
            db.execute(text("""
                CREATE UNIQUE INDEX uq_member_point_idempotency
                ON member_point_ledgers (member_id, idempotency_key)
                WHERE idempotency_key IS NOT NULL
            """))
            db.commit()
            print("✅ member_point_ledgers 테이블 생성 완료")
        else:
            db.commit()
            print("ℹ️ member_point_ledgers 테이블 이미 존재")
        print("✅ members 포인트 컬럼 확인 완료")
    except Exception as e:
        db.rollback()
        print(f"❌ add_member_points 마이그레이션 오류: {e}")
        raise
    finally:
        db.close()
