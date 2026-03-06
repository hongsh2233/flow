"""
시장의 목소리: person_master, market_voices 테이블 생성 및 10명 인물 시드

- person_master: 주요 경제 인물 (이름, 직함, 검색 키워드)
- market_voices: 뉴스 기반 AI 요약 (pending/approved 상태)
"""
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.engine.models import Base
from app.engine.database import SQLALCHEMY_DATABASE_URL

# 시드할 10명 인물 (이름, 직함, 검색키워드)
PERSON_MASTER_SEED = [
    ("구윤철", "경제부총리", "구윤철"),
    ("제롬 파월", "연준 의장", "제롬 파월"),
    ("재닛 옐런", "미 재무장관", "재닛 옐런"),
    ("크리스틴 라가르드", "ECB 총재", "크리스틴 라가르드"),
    ("이창용", "한국은행 총재", "이창용"),
    ("기시다 후미오", "일본 총리", "기시다 후미오"),
    ("리커창", "중국 총리", "리커창"),
    ("올라프 숄츠", "독일 총리", "올라프 숄츠"),
    ("필립 레인", "ECB 수석 이코노미스트", "필립 레인"),
    ("존 윌리엄스", "뉴욕연준 총재", "존 윌리엄스"),
]


def upgrade():
    """person_master, market_voices 테이블 생성 및 인물 시드"""
    with engine.connect() as conn:
        try:
            # 1. person_master 테이블
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'person_master'
            """))
            if result.scalar() == 0:
                conn.execute(text("""
                    CREATE TABLE person_master (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        title VARCHAR(150),
                        search_keyword VARCHAR(100) NOT NULL,
                        image_url VARCHAR(500),
                        order_index INTEGER NOT NULL DEFAULT 0,
                        is_active VARCHAR(20) DEFAULT 'active',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("CREATE INDEX ix_person_master_search_keyword ON person_master (search_keyword)"))
                conn.execute(text("CREATE INDEX ix_person_master_is_active ON person_master (is_active)"))
                print("person_master 테이블 생성 완료")

            # 2. market_voices 테이블
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'market_voices'
            """))
            if result.scalar() == 0:
                conn.execute(text("""
                    CREATE TABLE market_voices (
                        id SERIAL PRIMARY KEY,
                        person_id INTEGER NOT NULL REFERENCES person_master(id) ON DELETE CASCADE,
                        statement VARCHAR(100) NOT NULL,
                        source_url VARCHAR(1000),
                        source_title VARCHAR(500),
                        status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        news_pub_date VARCHAR(100),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        approved_at TIMESTAMP WITH TIME ZONE
                    )
                """))
                conn.execute(text("CREATE INDEX ix_market_voices_person_id ON market_voices (person_id)"))
                conn.execute(text("CREATE INDEX ix_market_voices_status ON market_voices (status)"))
                conn.execute(text("CREATE INDEX ix_market_voices_created_at ON market_voices (created_at)"))
                print("market_voices 테이블 생성 완료")

            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"테이블 생성 실패: {e}")
            raise

    # 3. 인물 시드 (이미 있으면 스킵)
    db = SessionLocal()
    try:
        from app.engine.models import PersonMaster
        existing = db.query(PersonMaster).count()
        if existing == 0:
            for i, (name, title, keyword) in enumerate(PERSON_MASTER_SEED):
                p = PersonMaster(
                    name=name,
                    title=title,
                    search_keyword=keyword,
                    order_index=i + 1,
                    is_active="active",
                )
                db.add(p)
            db.commit()
            print(f"person_master 시드 완료: {len(PERSON_MASTER_SEED)}명")
        else:
            print(f"person_master 이미 {existing}명 존재, 시드 스킵")
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
