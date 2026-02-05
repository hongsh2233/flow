"""
네이버 증권 랭킹 데이터 테이블 생성 마이그레이션

이 마이그레이션은 naver_stock_ranking 테이블을 생성합니다.
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """
    네이버 증권 랭킹 데이터 테이블 생성
    """
    with engine.connect() as conn:
        try:
            # 테이블이 이미 존재하는지 확인 (PostgreSQL 호환)
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'naver_stock_ranking'
            """))

            if result.scalar() > 0:
                print("ℹ️ naver_stock_ranking 테이블이 이미 존재합니다.")
                return

            # 테이블 생성 (PostgreSQL 호환)
            conn.execute(text("""
                CREATE TABLE naver_stock_ranking (
                    id SERIAL PRIMARY KEY,
                    ranking_type VARCHAR(20) NOT NULL,
                    market_type VARCHAR(20) NOT NULL,
                    rank INTEGER NOT NULL,
                    stock_code VARCHAR(10) NOT NULL,
                    stock_name VARCHAR(100) NOT NULL,
                    current_price VARCHAR(20),
                    change VARCHAR(20),
                    change_percent VARCHAR(20),
                    volume VARCHAR(30),
                    amount VARCHAR(30),
                    collected_at TIMESTAMP NOT NULL,
                    collected_time VARCHAR(5) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (ranking_type, market_type, rank, collected_at)
                )
            """))

            # 인덱스 생성
            conn.execute(text("CREATE INDEX idx_ranking_type ON naver_stock_ranking (ranking_type)"))
            conn.execute(text("CREATE INDEX idx_market_type ON naver_stock_ranking (market_type)"))
            conn.execute(text("CREATE INDEX idx_stock_code ON naver_stock_ranking (stock_code)"))
            conn.execute(text("CREATE INDEX idx_collected_at ON naver_stock_ranking (collected_at)"))
            conn.execute(text("CREATE INDEX idx_collected_time ON naver_stock_ranking (collected_time)"))

            conn.commit()
            print("✅ naver_stock_ranking 테이블 생성 완료")

        except Exception as e:
            conn.rollback()
            print(f"❌ naver_stock_ranking 테이블 생성 실패: {e}")
            raise


if __name__ == "__main__":
    upgrade()
