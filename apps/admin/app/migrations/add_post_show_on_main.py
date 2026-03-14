"""
게시글 메인 노출 컬럼 추가
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'show_on_main'
            """))
            if result.scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE posts ADD COLUMN show_on_main BOOLEAN NOT NULL DEFAULT FALSE
                """))
                conn.commit()
                print("posts 테이블에 show_on_main 컬럼 추가 완료")
            else:
                print("posts 테이블에 show_on_main 컬럼이 이미 존재합니다.")
        except Exception as e:
            conn.rollback()
            raise


if __name__ == "__main__":
    upgrade()
