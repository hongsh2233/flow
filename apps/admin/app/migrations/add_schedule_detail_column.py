"""
일정 테이블에 detail(상세 내용) 컬럼 추가 마이그레이션
"""
from sqlalchemy import text
from app.database import SessionLocal


def migrate_schedule_detail():
    """schedules 테이블에 detail 컬럼 추가"""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'schedules'
            AND column_name = 'detail'
        """))
        has_detail = result.fetchone() is not None

        if not has_detail:
            print("📝 detail 컬럼 추가 중...")
            db.execute(text("ALTER TABLE schedules ADD COLUMN detail TEXT"))
            db.commit()
            print("✅ detail 컬럼 추가 완료")
        else:
            print("ℹ️ detail 컬럼이 이미 존재합니다.")
    except Exception as e:
        db.rollback()
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_schedule_detail()
