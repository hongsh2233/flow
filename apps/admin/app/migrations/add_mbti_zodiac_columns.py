"""
members 테이블에 mbti_type, zodiac_animal, zodiac_sign 컬럼 추가
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE members
            ADD COLUMN IF NOT EXISTS mbti_type VARCHAR(10) NULL,
            ADD COLUMN IF NOT EXISTS zodiac_animal VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS zodiac_sign VARCHAR(30) NULL
        """))
        conn.commit()
        print("✅ mbti_type, zodiac_animal, zodiac_sign 컬럼 추가 완료")


def downgrade():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE members
            DROP COLUMN IF EXISTS mbti_type,
            DROP COLUMN IF EXISTS zodiac_animal,
            DROP COLUMN IF EXISTS zodiac_sign
        """))
        conn.commit()
        print("✅ mbti_type, zodiac_animal, zodiac_sign 컬럼 제거 완료")


if __name__ == "__main__":
    print("MBTI/zodiac 컬럼 추가 마이그레이션 시작...")
    upgrade()
    print("마이그레이션 완료!")
