"""
polls, poll_options 테이블 생성 및 poll_votes 마이그레이션
- 기존 poll_votes(posts.id FK) → 새 poll_votes(polls.id FK)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # 1. polls 테이블 생성
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'polls'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE polls (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX ix_polls_start_date ON polls (start_date)"))
            db.execute(text("CREATE INDEX ix_polls_end_date ON polls (end_date)"))
            db.commit()
            print("✅ polls 테이블 생성 완료")
        else:
            print("ℹ️ polls 테이블 이미 존재")

        # 2. poll_options 테이블 생성
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'poll_options'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE poll_options (
                    id SERIAL PRIMARY KEY,
                    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                    text VARCHAR(255) NOT NULL,
                    order_index INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX ix_poll_options_poll_id ON poll_options (poll_id)"))
            db.commit()
            print("✅ poll_options 테이블 생성 완료")
        else:
            print("ℹ️ poll_options 테이블 이미 존재")

        # 3. poll_votes 마이그레이션: 기존 테이블이 posts FK를 참조하면 drop 후 재생성
        r = db.execute(text("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'poll_votes'
            AND constraint_type = 'FOREIGN KEY'
        """))
        fks = r.fetchall()
        if fks:
            for (fk_name,) in fks:
                db.execute(text(f"ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS {fk_name}"))
            db.commit()

        # poll_votes가 posts.id를 참조하는 FK가 있으면 테이블 drop 후 재생성
        r = db.execute(text("""
            SELECT tc.constraint_name, ccu.table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = 'poll_votes'
            AND tc.constraint_type = 'FOREIGN KEY'
        """))
        refs = r.fetchall()
        if refs and any(t[1] == "posts" for t in refs):
            db.execute(text("DROP TABLE IF EXISTS poll_votes CASCADE"))
            db.commit()
            print("ℹ️ 기존 poll_votes 테이블 삭제 (posts FK → polls FK 전환)")

        # 4. poll_votes 테이블 생성 (polls FK)
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'poll_votes'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE poll_votes (
                    id SERIAL PRIMARY KEY,
                    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                    option_index INTEGER NOT NULL,
                    vote_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_pollvote_poll_option UNIQUE (poll_id, option_index)
                )
            """))
            db.execute(text("CREATE INDEX ix_poll_votes_poll_id ON poll_votes (poll_id)"))
            db.commit()
            print("✅ poll_votes 테이블 생성 완료")
        else:
            print("ℹ️ poll_votes 테이블 이미 존재")

    except Exception as e:
        db.rollback()
        print(f"❌ polls 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()
