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
        # 1. start_date, end_date 컬럼 크기 확장 (VARCHAR(10) -> VARCHAR(16)) (PostgreSQL 호환)
        print("📝 start_date, end_date 컬럼 크기 확장 중...")
        try:
            db.execute(text("ALTER TABLE main_page_items ALTER COLUMN start_date TYPE VARCHAR(16)"))
            db.execute(text("ALTER TABLE main_page_items ALTER COLUMN end_date TYPE VARCHAR(16)"))
            db.commit()
            print("✅ start_date, end_date 컬럼 크기 확장 완료")
        except Exception as e:
            print(f"⚠️ 컬럼 크기 확장 실패 (이미 확장되어 있을 수 있음): {e}")
            db.rollback()

        # 헬퍼: 컬럼 존재 여부 확인
        def has_column(table_name, column_name):
            result = db.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = :table_name
                AND column_name = :column_name
            """), {"table_name": table_name, "column_name": column_name})
            return result.fetchone() is not None

        # 2. repeat_type 컬럼 확인 및 추가
        if not has_column('main_page_items', 'repeat_type'):
            print("📝 repeat_type 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_type VARCHAR(20) DEFAULT 'none'"))
            db.commit()
            print("✅ repeat_type 컬럼 추가 완료")
        else:
            print("✅ repeat_type 컬럼이 이미 존재합니다.")

        # 3. repeat_days 컬럼 확인 및 추가
        if not has_column('main_page_items', 'repeat_days'):
            print("📝 repeat_days 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_days VARCHAR(20) NULL"))
            db.commit()
            print("✅ repeat_days 컬럼 추가 완료")
        else:
            print("✅ repeat_days 컬럼이 이미 존재합니다.")

        # 4. repeat_start_time 컬럼 확인 및 추가
        if not has_column('main_page_items', 'repeat_start_time'):
            print("📝 repeat_start_time 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_start_time VARCHAR(5) NULL"))
            db.commit()
            print("✅ repeat_start_time 컬럼 추가 완료")
        else:
            print("✅ repeat_start_time 컬럼이 이미 존재합니다.")

        # 5. repeat_end_time 컬럼 확인 및 추가
        if not has_column('main_page_items', 'repeat_end_time'):
            print("📝 repeat_end_time 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_end_time VARCHAR(5) NULL"))
            db.commit()
            print("✅ repeat_end_time 컬럼 추가 완료")
        else:
            print("✅ repeat_end_time 컬럼이 이미 존재합니다.")

        # 6. repeat_next_day 컬럼 확인 및 추가
        if not has_column('main_page_items', 'repeat_next_day'):
            print("📝 repeat_next_day 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN repeat_next_day VARCHAR(5) DEFAULT 'false'"))
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
