"""
게시판 카테고리 기능 추가 마이그레이션
- boards 테이블에 use_categories 컬럼 추가
- board_categories 테이블 생성
- posts 테이블에 category_id 컬럼 추가
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            # 1. boards 테이블에 use_categories 컬럼 추가
            check_uc = text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'boards'
                AND column_name = 'use_categories'
            """)
            if conn.execute(check_uc).scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE boards ADD COLUMN use_categories VARCHAR(20) DEFAULT 'false'
                """))
                conn.commit()
                print("✅ boards.use_categories 컬럼 추가 완료")

            # 2. board_categories 테이블 생성
            check_table = text("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'board_categories'
            """)
            if conn.execute(check_table).scalar() == 0:
                conn.execute(text("""
                    CREATE TABLE board_categories (
                        id SERIAL PRIMARY KEY,
                        board_id VARCHAR(20) NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                        name VARCHAR(100) NOT NULL,
                        order_index INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX ix_board_categories_board_id ON board_categories(board_id)"))
                conn.commit()
                print("✅ board_categories 테이블 생성 완료")

            # 3. posts 테이블에 category_id 컬럼 추가
            check_cat = text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'posts'
                AND column_name = 'category_id'
            """)
            if conn.execute(check_cat).scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE posts ADD COLUMN category_id INTEGER
                    REFERENCES board_categories(id) ON DELETE SET NULL
                """))
                conn.execute(text("CREATE INDEX ix_posts_category_id ON posts(category_id)"))
                conn.commit()
                print("✅ posts.category_id 컬럼 추가 완료")

        except Exception as e:
            conn.rollback()
            print(f"⚠️ 게시판 카테고리 마이그레이션 오류: {e}")
            raise


if __name__ == "__main__":
    upgrade()
