"""
Member 테이블에 jubti_type(주BTI 투자 성향) 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """jubti_type 컬럼 추가 (A|D|N|I)"""
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE members
                ADD COLUMN jubti_type VARCHAR(10) NULL
            """))
            conn.commit()
            print("✅ jubti_type 컬럼이 추가되었습니다.")
        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("ℹ️ jubti_type 컬럼이 이미 존재합니다.")
            else:
                print(f"❌ 오류 발생: {e}")
                conn.rollback()
                raise


def downgrade():
    """jubti_type 컬럼 제거"""
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE members
                DROP COLUMN jubti_type
            """))
            conn.commit()
            print("✅ jubti_type 컬럼이 제거되었습니다.")
        except Exception as e:
            if "doesn't exist" in str(e).lower() or "Unknown column" in str(e):
                print("ℹ️ jubti_type 컬럼이 존재하지 않습니다.")
            else:
                print(f"❌ 오류 발생: {e}")
                conn.rollback()
                raise


if __name__ == "__main__":
    print("주BTI(jubti_type) 컬럼 추가 마이그레이션 시작...")
    upgrade()
    print("마이그레이션 완료!")
