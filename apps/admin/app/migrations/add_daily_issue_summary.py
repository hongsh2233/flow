"""
daily_issue_summaries 테이블 생성 및 스키마 업그레이드
- 초기: date UNIQUE (하루 1건 upsert)
- v2: UNIQUE 제약 제거 + collected_time 컬럼 추가 → 하루 여러 건 누적 (08:40 / 12:40 / 19:40)
      2일치 보관 후 3일째 자동 삭제
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # ─── 1. 테이블 없으면 새로 생성 ─────────────────────────────────
        r = db.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'daily_issue_summaries'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                CREATE TABLE daily_issue_summaries (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    collected_time VARCHAR(5),
                    summary TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX ix_daily_issue_summaries_date ON daily_issue_summaries (date)"))
            db.commit()
            print("✅ daily_issue_summaries 테이블 생성 완료 (누적형 v2)")
            return

        # ─── 2. 기존 테이블 → UNIQUE 제약 제거 + collected_time 컬럼 추가 ─
        db.execute(text("""
            DO $$
            DECLARE
                cname TEXT;
            BEGIN
                SELECT constraint_name INTO cname
                FROM information_schema.table_constraints
                WHERE table_name = 'daily_issue_summaries'
                  AND constraint_type = 'UNIQUE'
                LIMIT 1;
                IF cname IS NOT NULL THEN
                    EXECUTE 'ALTER TABLE daily_issue_summaries DROP CONSTRAINT ' || quote_ident(cname);
                    RAISE NOTICE 'UNIQUE 제약 제거: %', cname;
                END IF;
            END$$;
        """))

        # collected_time 컬럼 추가 (없으면)
        db.execute(text("""
            ALTER TABLE daily_issue_summaries
            ADD COLUMN IF NOT EXISTS collected_time VARCHAR(5)
        """))

        db.commit()
        print("✅ daily_issue_summaries 스키마 업그레이드 완료 (UNIQUE 제거, collected_time 추가)")

    except Exception as e:
        db.rollback()
        print(f"❌ daily_issue_summaries 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()
