"""
일정 테이블에 scheduled_time(시간) 컬럼 추가
"""
from sqlalchemy import text
from app.database import SessionLocal


def migrate_schedule_time():
    """schedules 테이블에 scheduled_time 컬럼 추가 (HH:mm 형식)"""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'schedules'
            AND column_name = 'scheduled_time'
        """))
        has_col = result.fetchone() is not None

        if not has_col:
            print("📝 scheduled_time 컬럼 추가 중...")
            db.execute(text("ALTER TABLE schedules ADD COLUMN scheduled_time VARCHAR(5)"))
            db.commit()
            print("✅ scheduled_time 컬럼 추가 완료")
        else:
            print("ℹ️ scheduled_time 컬럼이 이미 존재합니다.")
    except Exception as e:
        db.rollback()
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_schedule_time()
