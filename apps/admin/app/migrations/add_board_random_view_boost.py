"""
boards.random_view_boost 컬럼 추가
- true: 게시글 상세 조회 시 조회수가 1~8 사이 랜덤만큼 증가
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            check_col = text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'boards'
                AND column_name = 'random_view_boost'
            """)
            if conn.execute(check_col).scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE boards ADD COLUMN random_view_boost VARCHAR(20) DEFAULT 'false'
                """))
                conn.commit()
                print("✅ boards.random_view_boost 컬럼 추가 완료")
        except Exception as e:
            conn.rollback()
            print(f"⚠️ random_view_boost 마이그레이션 오류: {e}")
            raise


if __name__ == "__main__":
    upgrade()
