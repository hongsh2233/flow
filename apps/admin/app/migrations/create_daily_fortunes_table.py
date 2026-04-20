"""
daily_fortunes 테이블 생성 (띠/별자리 오늘의 운세 캐시)
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS daily_fortunes (
                id SERIAL PRIMARY KEY,
                fortune_date DATE NOT NULL,
                fortune_type VARCHAR(10) NOT NULL,
                key VARCHAR(30) NOT NULL,
                fortune_text TEXT NOT NULL,
                investment_tip TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_daily_fortune UNIQUE (fortune_date, fortune_type, key)
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_daily_fortunes_date
            ON daily_fortunes (fortune_date)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_daily_fortunes_type_key
            ON daily_fortunes (fortune_type, key)
        """))
        conn.commit()
        print("✅ daily_fortunes 테이블 생성 완료")


def downgrade():
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS daily_fortunes"))
        conn.commit()
        print("✅ daily_fortunes 테이블 제거 완료")


if __name__ == "__main__":
    print("daily_fortunes 테이블 생성 마이그레이션 시작...")
    upgrade()
    print("마이그레이션 완료!")
