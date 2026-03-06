"""
네이버 뉴스 주가 영향 뉴스 테이블 생성 마이그레이션

이 마이그레이션은 naver_stock_news 테이블을 생성합니다.
수주, 실적발표, 배당, 연구개발, 기술이전, 유상증자 등 주가에 직접 영향을 미치는 뉴스를 저장합니다.
"""
from sqlalchemy import text
from app.database import engine


def upgrade():
    """
    네이버 주가 영향 뉴스 테이블 생성
    """
    with engine.connect() as conn:
        try:
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'naver_stock_news'
            """))

            if result.scalar() > 0:
                print("naver_stock_news 테이블이 이미 존재합니다.")
                return

            conn.execute(text("""
                CREATE TABLE naver_stock_news (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(30) NOT NULL,
                    keyword VARCHAR(50) NOT NULL,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    link VARCHAR(1000) NOT NULL,
                    pub_date VARCHAR(100),
                    pub_datetime TIMESTAMP WITH TIME ZONE,
                    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_naver_stock_news_link UNIQUE (link)
                )
            """))

            conn.execute(text("CREATE INDEX ix_naver_stock_news_category ON naver_stock_news (category)"))
            conn.execute(text("CREATE INDEX ix_naver_stock_news_keyword ON naver_stock_news (keyword)"))
            conn.execute(text("CREATE INDEX ix_naver_stock_news_pub_datetime ON naver_stock_news (pub_datetime)"))
            conn.execute(text("CREATE INDEX ix_naver_stock_news_collected_at ON naver_stock_news (collected_at)"))
            conn.execute(text("CREATE INDEX ix_naver_stock_news_category_pub ON naver_stock_news (category, pub_datetime)"))

            conn.commit()
            print("naver_stock_news 테이블 생성 완료")

        except Exception as e:
            conn.rollback()
            print(f"naver_stock_news 테이블 생성 실패: {e}")
            raise


if __name__ == "__main__":
    upgrade()
