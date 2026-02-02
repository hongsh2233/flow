"""
게시글 테이블에 is_secret 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """
    posts 테이블에 is_secret 컬럼 추가
    """
    with engine.connect() as conn:
        try:
            # is_secret 컬럼이 이미 존재하는지 확인
            check_query = text("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'posts' 
                AND COLUMN_NAME = 'is_secret'
            """)
            result = conn.execute(check_query)
            exists = result.scalar() > 0
            
            if not exists:
                # is_secret 컬럼 추가
                alter_query = text("""
                    ALTER TABLE posts 
                    ADD COLUMN is_secret VARCHAR(20) DEFAULT 'false' 
                    AFTER views
                """)
                conn.execute(alter_query)
                conn.commit()
                print("✅ posts 테이블에 is_secret 컬럼 추가 완료")
            else:
                print("ℹ️ posts 테이블에 is_secret 컬럼이 이미 존재합니다.")
        except Exception as e:
            print(f"⚠️ is_secret 컬럼 추가 중 오류 발생: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    upgrade()
