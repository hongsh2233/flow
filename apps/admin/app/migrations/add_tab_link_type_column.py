"""
nav_menu_tabs 테이블에 link_type 컬럼 추가 마이그레이션

이 마이그레이션은 서브 메뉴/탭에 게시판 또는 페이지 연결 유형을 지정할 수 있도록
link_type 컬럼을 추가합니다.

link_type: 'page' (기본값) 또는 'board'
- page: 페이지 경로 (예: /news, /report)
- board: 게시판 ID (예: B001)
"""
from sqlalchemy import text
from app.database import SessionLocal


def run_migration(db=None):
    """nav_menu_tabs 테이블에 link_type 컬럼 추가"""
    # DB 세션이 없으면 생성
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        # 1. nav_menu_tabs 테이블이 있는지 확인 (PostgreSQL)
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'nav_menu_tabs'
        """))
        has_table = result.fetchone() is not None

        if not has_table:
            print("⚠️ nav_menu_tabs 테이블이 존재하지 않습니다. 서버 재시작 시 자동으로 생성됩니다.")
            return

        # 2. link_type 컬럼이 있는지 확인 (PostgreSQL)
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'nav_menu_tabs'
            AND column_name = 'link_type'
        """))
        has_link_type = result.fetchone() is not None

        # 3. link_type 컬럼이 없으면 추가
        if not has_link_type:
            print("📝 link_type 컬럼 추가 중...")
            db.execute(text("""
                ALTER TABLE nav_menu_tabs
                ADD COLUMN link_type VARCHAR(20) NOT NULL DEFAULT 'page'
            """))
            db.commit()
            print("✅ link_type 컬럼 추가 완료")
        else:
            print("✅ link_type 컬럼이 이미 존재합니다.")

        print("✅ nav_menu_tabs 테이블 마이그레이션 완료")

    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        db.rollback()
        raise
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("nav_menu_tabs 테이블 link_type 컬럼 추가 마이그레이션 시작...")
    run_migration()
    print("마이그레이션 완료!")
