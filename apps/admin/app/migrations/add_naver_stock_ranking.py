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
            # 테이블이 이미 존재하는지 확인
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'naver_stock_ranking'
            """))
            
            if result.scalar() > 0:
                print("ℹ️ naver_stock_ranking 테이블이 이미 존재합니다.")
                return
            
            # 테이블 생성
            conn.execute(text("""
                CREATE TABLE naver_stock_ranking (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ranking_type VARCHAR(20) NOT NULL,
                    market_type VARCHAR(20) NOT NULL,
                    rank INT NOT NULL,
                    stock_code VARCHAR(10) NOT NULL,
                    stock_name VARCHAR(100) NOT NULL,
                    current_price VARCHAR(20),
                    change VARCHAR(20),
                    change_percent VARCHAR(20),
                    volume VARCHAR(30),
                    amount VARCHAR(30),
                    collected_at DATETIME NOT NULL,
                    collected_time VARCHAR(5) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ranking_type (ranking_type),
                    INDEX idx_market_type (market_type),
                    INDEX idx_stock_code (stock_code),
                    INDEX idx_collected_at (collected_at),
                    INDEX idx_collected_time (collected_time),
                    UNIQUE KEY uq_naver_ranking (ranking_type, market_type, rank, collected_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            conn.commit()
            print("✅ naver_stock_ranking 테이블 생성 완료")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ naver_stock_ranking 테이블 생성 실패: {e}")
            raise


if __name__ == "__main__":
    upgrade()

