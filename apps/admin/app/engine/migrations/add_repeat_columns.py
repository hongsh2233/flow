"""
메인 페이지 항목 테이블에 반복 설정 컬럼 추가 마이그레이션

repeat_type, repeat_days, repeat_start_time, repeat_end_time 컬럼을 추가하고
start_date, end_date 컬럼 크기를 확장합니다.
"""
from sqlalchemy import text
from app.database import SessionLocal


def run_migration(db=None):
    """main_page_items 테이블에 반복 설정 컬럼 추가"""
    # DB 세션이 없으면 생성
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        # 1. start_date, end_date 컬럼 크기 확장 (VARCHAR(10) -> VARCHAR(16))
        print("📝 start_date, end_date 컬럼 크기 확장 중...")
        try:
            db.execute(text("ALTER TABLE main_page_items MODIFY COLUMN start_date VARCHAR(16) NULL"))
            db.execute(text("ALTER TABLE main_page_items MODIFY COLUMN end_date VARCHAR(16) NULL"))
            db.commit()
            print("✅ start_date, end_date 컬럼 크기 확장 완료")
        except Exception as e:
            print(f"⚠️ 컬럼 크기 확장 실패 (이미 확장되어 있을 수 있음): {e}")
            db.rollback()

        # 2. repeat_type 컬럼 확인 및 추가
        result = db.execute(text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'main_page_items'
            AND COLUMN_NAME = 'repeat_type'
        """))
        has_repeat_type = result.fetchone() is not None

        if not has_repeat_type:
            print("📝 repeat_type 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_type VARCHAR(20) DEFAULT 'none' AFTER end_date"))
            db.commit()
            print("✅ repeat_type 컬럼 추가 완료")
        else:
            print("✅ repeat_type 컬럼이 이미 존재합니다.")

        # 3. repeat_days 컬럼 확인 및 추가
        result = db.execute(text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'main_page_items'
            AND COLUMN_NAME = 'repeat_days'
        """))
        has_repeat_days = result.fetchone() is not None

        if not has_repeat_days:
            print("📝 repeat_days 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_days VARCHAR(20) NULL AFTER repeat_type"))
            db.commit()
            print("✅ repeat_days 컬럼 추가 완료")
        else:
            print("✅ repeat_days 컬럼이 이미 존재합니다.")

        # 4. repeat_start_time 컬럼 확인 및 추가
        result = db.execute(text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'main_page_items'
            AND COLUMN_NAME = 'repeat_start_time'
        """))
        has_repeat_start_time = result.fetchone() is not None

        if not has_repeat_start_time:
            print("📝 repeat_start_time 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_start_time VARCHAR(5) NULL AFTER repeat_days"))
            db.commit()
            print("✅ repeat_start_time 컬럼 추가 완료")
        else:
            print("✅ repeat_start_time 컬럼이 이미 존재합니다.")

        # 5. repeat_end_time 컬럼 확인 및 추가
        result = db.execute(text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'main_page_items'
            AND COLUMN_NAME = 'repeat_end_time'
        """))
        has_repeat_end_time = result.fetchone() is not None

        if not has_repeat_end_time:
            print("📝 repeat_end_time 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_end_time VARCHAR(5) NULL AFTER repeat_start_time"))
            db.commit()
            print("✅ repeat_end_time 컬럼 추가 완료")
        else:
            print("✅ repeat_end_time 컬럼이 이미 존재합니다.")

        # 6. repeat_next_day 컬럼 확인 및 추가
        result = db.execute(text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'main_page_items'
            AND COLUMN_NAME = 'repeat_next_day'
        """))
        has_repeat_next_day = result.fetchone() is not None

        if not has_repeat_next_day:
            print("📝 repeat_next_day 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_next_day VARCHAR(5) DEFAULT 'false' AFTER repeat_end_time"))
            db.commit()
            print("✅ repeat_next_day 컬럼 추가 완료")
        else:
            print("✅ repeat_next_day 컬럼이 이미 존재합니다.")

        print("✅ 메인 페이지 항목 반복 설정 컬럼 추가 완료")
    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        db.rollback()
        raise
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("메인 페이지 항목 반복 설정 컬럼 추가 마이그레이션 시작...")
    run_migration()
    print("마이그레이션 완료!")
