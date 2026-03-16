"""
게시글 대기/승인 상태 컬럼 추가
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            # status 컬럼
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'status'
            """))
            if result.scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE posts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved'
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_posts_status ON posts (status)
                """))
                conn.commit()
                print("posts 테이블에 status 컬럼 추가 완료")
            else:
                print("posts 테이블에 status 컬럼이 이미 존재합니다.")

            # approved_at 컬럼
            result2 = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'approved_at'
            """))
            if result2.scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE posts ADD COLUMN approved_at TIMESTAMPTZ
                """))
                conn.commit()
                print("posts 테이블에 approved_at 컬럼 추가 완료")
            else:
                print("posts 테이블에 approved_at 컬럼이 이미 존재합니다.")
        except Exception as e:
            conn.rollback()
            raise


if __name__ == "__main__":
    upgrade()
