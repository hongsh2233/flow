"""
poll_vote_records 테이블 생성 - 투표자별 1인 1표 제한
- voter_key: guest_id (예: g_xxx) 또는 member_id 문자열
- (poll_id, voter_key) UNIQUE로 중복 투표 방지
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'poll_vote_records'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE poll_vote_records (
                    id SERIAL PRIMARY KEY,
                    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                    voter_key VARCHAR(255) NOT NULL,
                    option_index INTEGER NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_poll_vote_record UNIQUE (poll_id, voter_key)
                )
            """))
            db.execute(text("CREATE INDEX ix_poll_vote_records_poll_id ON poll_vote_records (poll_id)"))
            db.execute(text("CREATE INDEX ix_poll_vote_records_voter_key ON poll_vote_records (voter_key)"))
            db.commit()
            print("✅ poll_vote_records 테이블 생성 완료 (1인 1표)")
        else:
            print("ℹ️ poll_vote_records 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ poll_vote_records 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()
