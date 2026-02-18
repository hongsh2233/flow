"""
Member 테이블에 favorite_stocks 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """favorite_stocks 컬럼 추가"""
    with engine.connect() as conn:
        try:
            # favorite_stocks 컬럼 추가 (NULL 허용)
            conn.execute(text("""
                ALTER TABLE members 
                ADD COLUMN favorite_stocks TEXT NULL
            """))
            conn.commit()
            print("✅ favorite_stocks 컬럼이 추가되었습니다.")
        except Exception as e:
            # 이미 컬럼이 존재하는 경우 무시
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("ℹ️ favorite_stocks 컬럼이 이미 존재합니다.")
            else:
                print(f"❌ 오류 발생: {e}")
                conn.rollback()
                raise


def downgrade():
    """favorite_stocks 컬럼 제거"""
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE members 
                DROP COLUMN favorite_stocks
            """))
            conn.commit()
            print("✅ favorite_stocks 컬럼이 제거되었습니다.")
        except Exception as e:
            if "doesn't exist" in str(e).lower() or "Unknown column" in str(e):
                print("ℹ️ favorite_stocks 컬럼이 존재하지 않습니다.")
            else:
                print(f"❌ 오류 발생: {e}")
                conn.rollback()
                raise


if __name__ == "__main__":
    print("관심종목 컬럼 추가 마이그레이션 시작...")
    upgrade()
    print("마이그레이션 완료!")
