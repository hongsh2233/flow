"""
bo_events, bo_event_participations, grade_policies, grade_policy_logs 테이블 생성
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS bo_events (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                event_type VARCHAR(30) NOT NULL,
                description TEXT,
                start_date TIMESTAMPTZ,
                end_date TIMESTAMPTZ,
                is_active BOOLEAN NOT NULL DEFAULT true,
                max_participants INTEGER,
                benefit_type VARCHAR(20) NOT NULL,
                benefit_grade VARCHAR(20) NOT NULL DEFAULT 'vip',
                benefit_days INTEGER NOT NULL,
                trigger_condition JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
            """
            )
        )
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_bo_events_event_type ON bo_events (event_type)"))
        db.commit()
        print("✅ bo_events 테이블 확인/생성 완료")

        db.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS bo_event_participations (
                id SERIAL PRIMARY KEY,
                event_id INTEGER NOT NULL REFERENCES bo_events(id) ON DELETE CASCADE,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                participated_at TIMESTAMPTZ DEFAULT NOW(),
                benefit_applied BOOLEAN NOT NULL DEFAULT false,
                benefit_expires TIMESTAMPTZ,
                CONSTRAINT uq_bo_event_member UNIQUE (event_id, member_id)
            )
            """
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_bo_event_participations_event_id ON bo_event_participations (event_id)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_bo_event_participations_member_id ON bo_event_participations (member_id)"
            )
        )
        db.commit()
        print("✅ bo_event_participations 테이블 확인/생성 완료")

        db.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS grade_policies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                target_grade VARCHAR(20) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                is_auto BOOLEAN NOT NULL DEFAULT false,
                condition_type VARCHAR(30) NOT NULL,
                conditions_json JSONB,
                benefit_days INTEGER,
                upgrade_once BOOLEAN NOT NULL DEFAULT true,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
            """
            )
        )
        db.commit()
        print("✅ grade_policies 테이블 확인/생성 완료")

        db.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS grade_policy_logs (
                id SERIAL PRIMARY KEY,
                policy_id INTEGER NOT NULL REFERENCES grade_policies(id) ON DELETE CASCADE,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                before_grade VARCHAR(20),
                after_grade VARCHAR(20),
                applied_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ,
                trigger_source VARCHAR(20) NOT NULL DEFAULT 'auto'
            )
            """
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_grade_policy_logs_policy_id ON grade_policy_logs (policy_id)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_grade_policy_logs_member_id ON grade_policy_logs (member_id)"
            )
        )
        db.commit()
        print("✅ grade_policy_logs 테이블 확인/생성 완료")
    except Exception as e:
        db.rollback()
        print(f"❌ add_bo_events_grade_policies: {e}")
        raise
    finally:
        db.close()
