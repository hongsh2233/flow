"""
게시글 테이블에 is_member_only 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """
    posts 테이블에 is_member_only 컬럼 추가
    """
    with engine.connect() as conn:
        try:
            check_query = text("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'posts'
                AND column_name = 'is_member_only'
            """)
            result = conn.execute(check_query)
            exists = result.scalar() > 0

            if not exists:
                alter_query = text("""
                    ALTER TABLE posts
                    ADD COLUMN is_member_only VARCHAR(20) DEFAULT 'false'
                """)
                conn.execute(alter_query)
                conn.commit()
                print("✅ posts 테이블에 is_member_only 컬럼 추가 완료")
            else:
                print("ℹ️ posts 테이블에 is_member_only 컬럼이 이미 존재합니다.")
        except Exception as e:
            print(f"⚠️ is_member_only 컬럼 추가 중 오류 발생: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    upgrade()
