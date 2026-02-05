"""
메인 페이지 항목 테이블에 노출 기간 컬럼 추가 마이그레이션

start_date, end_date 컬럼을 추가합니다.
"""
from sqlalchemy import text
from app.database import SessionLocal


def run_migration(db=None):
    """main_page_items 테이블에 노출 기간 컬럼 추가"""
    # DB 세션이 없으면 생성
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        # 1. start_date 컬럼이 있는지 확인 (PostgreSQL 호환)
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'main_page_items'
            AND column_name = 'start_date'
        """))
        has_start_date = result.fetchone() is not None

        # 2. start_date 컬럼이 없으면 추가
        if not has_start_date:
            print("📝 start_date 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN start_date VARCHAR(10) NULL"))
            db.commit()
            print("✅ start_date 컬럼 추가 완료")

        # 3. end_date 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'main_page_items'
            AND column_name = 'end_date'
        """))
        has_end_date = result.fetchone() is not None

        # 4. end_date 컬럼이 없으면 추가
        if not has_end_date:
            print("📝 end_date 컬럼 추가 중...")
            db.execute(text("ALTER TABLE main_page_items ADD COLUMN end_date VARCHAR(10) NULL"))
            db.commit()
            print("✅ end_date 컬럼 추가 완료")

        print("✅ 메인 페이지 항목 노출 기간 컬럼 추가 완료")
    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        db.rollback()
        raise
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("메인 페이지 항목 노출 기간 컬럼 추가 마이그레이션 시작...")
    run_migration()
    print("마이그레이션 완료!")
