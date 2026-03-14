"""
투자은행 뉴스 (GS, MS, JPM) - Yahoo 뉴스 수집용 테이블
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'investment_bank_news'
            """))
            if result.scalar() == 0:
                conn.execute(text("""
                    CREATE TABLE investment_bank_news (
                        id SERIAL PRIMARY KEY,
                        source VARCHAR(20) NOT NULL,
                        title VARCHAR(500) NOT NULL,
                        summary TEXT,
                        source_url VARCHAR(1000),
                        status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        news_pub_date VARCHAR(100),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        approved_at TIMESTAMP WITH TIME ZONE
                    )
                """))
                conn.execute(text("CREATE INDEX ix_investment_bank_news_source ON investment_bank_news (source)"))
                conn.execute(text("CREATE INDEX ix_investment_bank_news_status ON investment_bank_news (status)"))
                conn.execute(text("CREATE INDEX ix_investment_bank_news_created_at ON investment_bank_news (created_at)"))
                conn.commit()
                print("investment_bank_news 테이블 생성 완료")
            else:
                print("investment_bank_news 테이블이 이미 존재합니다.")
        except Exception as e:
            conn.rollback()
            raise


if __name__ == "__main__":
    upgrade()
