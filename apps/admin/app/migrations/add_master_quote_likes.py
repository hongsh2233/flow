"""
master_quote_likes 테이블 생성 - 대가들의 명언 좋아요 저장
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'master_quote_likes'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE master_quote_likes (
                    id SERIAL PRIMARY KEY,
                    master_quote_id INTEGER NOT NULL REFERENCES master_quotes(id) ON DELETE CASCADE,
                    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
                    guest_id VARCHAR(64),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT chk_like_identity CHECK (
                        (member_id IS NOT NULL AND guest_id IS NULL) OR
                        (member_id IS NULL AND guest_id IS NOT NULL)
                    )
                )
            """))
            db.execute(text("CREATE INDEX ix_master_quote_likes_quote ON master_quote_likes (master_quote_id)"))
            db.execute(text("CREATE INDEX ix_master_quote_likes_member ON master_quote_likes (member_id)"))
            db.execute(text("CREATE INDEX ix_master_quote_likes_guest ON master_quote_likes (guest_id)"))
            db.execute(text("""
                CREATE UNIQUE INDEX uq_master_quote_like_member
                ON master_quote_likes (master_quote_id, member_id) WHERE member_id IS NOT NULL
            """))
            db.execute(text("""
                CREATE UNIQUE INDEX uq_master_quote_like_guest
                ON master_quote_likes (master_quote_id, guest_id) WHERE guest_id IS NOT NULL
            """))
            db.commit()
            print("✅ master_quote_likes 테이블 생성 완료")
        else:
            print("ℹ️ master_quote_likes 테이블 이미 존재")
    finally:
        db.close()
