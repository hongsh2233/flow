"""
members 테이블의 provider_id 컬럼을 NULL 허용으로 변경하는 마이그레이션
이메일 가입 시 provider_id가 없으므로 NULL 허용이 필요합니다.
"""
from sqlalchemy import text
from app.database import SessionLocal


def run_migration():
    """members.provider_id 컬럼을 NULL 허용으로 변경"""
    db = SessionLocal()
    try:
        # members 테이블 존재 확인
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'members'
        """))
        if result.fetchone() is None:
            print("⚠️ members 테이블이 존재하지 않습니다.")
            return

        # provider_id 컬럼의 NOT NULL 제약 제거
        print("📝 provider_id 컬럼 NULL 허용으로 변경 중...")
        db.execute(text("ALTER TABLE members ALTER COLUMN provider_id DROP NOT NULL"))
        db.commit()
        print("✅ provider_id 컬럼 NULL 허용 변경 완료")

    except Exception as e:
        err_msg = str(e)
        if "already" in err_msg.lower() or "does not exist" in err_msg.lower():
            print("✅ provider_id 컬럼이 이미 NULL 허용 상태입니다")
        else:
            print(f"❌ provider_id 컬럼 마이그레이션 실패: {e}")
            db.rollback()
    finally:
        db.close()
