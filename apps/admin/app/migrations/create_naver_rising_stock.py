"""
네이버증권 상승률 상위 종목 테이블 생성
- naver_rising_stock: 10%이상 상승 종목, 하루 3회 수집 (12:00/15:40/20:30 KST)
"""
from sqlalchemy import text
from app.database import SessionLocal


def migrate():
    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS naver_rising_stock (
                id SERIAL PRIMARY KEY,
                market_type VARCHAR(10) NOT NULL,
                rank INTEGER NOT NULL,
                stock_code VARCHAR(10) NOT NULL,
                stock_name VARCHAR(100) NOT NULL,
                current_price VARCHAR(20),
                change VARCHAR(20),
                change_percent VARCHAR(20),
                volume VARCHAR(30),
                collected_at TIMESTAMPTZ NOT NULL,
                collected_time VARCHAR(5) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT uq_naver_rising_stock UNIQUE (market_type, rank, collected_at)
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_naver_rising_stock_market_type ON naver_rising_stock(market_type)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_naver_rising_stock_stock_code ON naver_rising_stock(stock_code)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_naver_rising_stock_collected_at ON naver_rising_stock(collected_at)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_naver_rising_stock_collected_time ON naver_rising_stock(collected_time)"))
        db.commit()
        print("✅ naver_rising_stock 테이블 생성 완료")
    except Exception as e:
        db.rollback()
        print(f"⚠️ naver_rising_stock 테이블 생성 중 오류 (이미 존재할 수 있음): {e}")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
