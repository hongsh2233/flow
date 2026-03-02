"""
naver_supply_data 테이블 생성
- 투자자별 매매동향, 수급 순위, 프로그램 매매 데이터 저장
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'naver_supply_data'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE naver_supply_data (
                    id SERIAL PRIMARY KEY,
                    data_type VARCHAR(30) NOT NULL,
                    market VARCHAR(20) NOT NULL DEFAULT 'all',
                    sub_key VARCHAR(30),
                    data_json TEXT,
                    bizdate VARCHAR(8) NOT NULL,
                    collected_time VARCHAR(5) NOT NULL,
                    collected_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_naver_supply_data
                        UNIQUE (data_type, market, sub_key, bizdate, collected_time)
                )
            """))
            db.execute(text("CREATE INDEX ix_naver_supply_data_data_type ON naver_supply_data (data_type)"))
            db.execute(text("CREATE INDEX ix_naver_supply_data_market ON naver_supply_data (market)"))
            db.execute(text("CREATE INDEX ix_naver_supply_data_sub_key ON naver_supply_data (sub_key)"))
            db.execute(text("CREATE INDEX ix_naver_supply_data_bizdate ON naver_supply_data (bizdate)"))
            db.execute(text("CREATE INDEX ix_naver_supply_data_collected_time ON naver_supply_data (collected_time)"))
            db.execute(text("CREATE INDEX ix_naver_supply_data_collected_at ON naver_supply_data (collected_at)"))
            db.commit()
            print("✅ naver_supply_data 테이블 생성 완료")
        else:
            print("ℹ️ naver_supply_data 테이블 이미 존재")
    except Exception as e:
        db.rollback()
        print(f"❌ naver_supply_data 마이그레이션 실패: {e}")
    finally:
        db.close()
