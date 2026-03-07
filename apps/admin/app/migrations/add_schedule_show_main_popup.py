"""
일정 테이블에 show_main_popup 컬럼 추가
중요일정 체크 시 당일 메인 페이지에 레이어팝업으로 표시
"""
from sqlalchemy import text
from app.database import SessionLocal


def migrate():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'schedules'
            AND column_name = 'show_main_popup'
        """))
        if result.fetchone() is not None:
            print("ℹ️ show_main_popup 컬럼이 이미 존재합니다.")
            return

        print("📝 show_main_popup 컬럼 추가 중...")
        db.execute(text("ALTER TABLE schedules ADD COLUMN show_main_popup BOOLEAN NOT NULL DEFAULT false"))
        db.commit()
        print("✅ show_main_popup 컬럼 추가 완료")
    except Exception as e:
        db.rollback()
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
