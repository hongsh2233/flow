"""
Member 테이블에 favorite_stocks 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """favorite_stocks 컬럼 추가 (이미 있으면 DB 에러 로그 없이 스킵)"""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE members
            ADD COLUMN IF NOT EXISTS favorite_stocks TEXT NULL
        """))
        conn.commit()
        print("✅ favorite_stocks 컬럼 확인/추가 완료 (IF NOT EXISTS).")


def downgrade():
    """favorite_stocks 컬럼 제거"""
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE members
                DROP COLUMN IF EXISTS favorite_stocks
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
