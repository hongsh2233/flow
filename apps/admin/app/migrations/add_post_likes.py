"""
post_likes 테이블 — 게시글 좋아요 (회원 1인 1게시글 1회)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'post_likes'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE post_likes (
                    id SERIAL PRIMARY KEY,
                    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_post_like_post_member UNIQUE (post_id, member_id)
                )
            """))
            db.execute(text("CREATE INDEX ix_post_likes_post_id ON post_likes (post_id)"))
            db.execute(text("CREATE INDEX ix_post_likes_member_id ON post_likes (member_id)"))
            db.commit()
            print("✅ post_likes 테이블 생성 완료")
        else:
            print("ℹ️ post_likes 테이블 이미 존재")
    finally:
        db.close()
