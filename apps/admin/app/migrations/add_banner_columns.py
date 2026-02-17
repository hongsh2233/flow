"""
배너 테이블에 display_type, content_type, html_content, page_paths, slide_group 컬럼 추가
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # display_type
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'display_type'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN display_type VARCHAR(20) DEFAULT 'single'"))
            db.commit()

        # content_type
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'content_type'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN content_type VARCHAR(20) DEFAULT 'image'"))
            db.commit()

        # html_content
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'html_content'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN html_content VARCHAR(5000) NULL"))
            db.commit()

        # page_paths
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'page_paths'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN page_paths VARCHAR(500) NULL"))
            db.commit()

        # slide_group
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'slide_group'
        """))
        if r.fetchone() is None:
            db.execute(text("ALTER TABLE banners ADD COLUMN slide_group VARCHAR(50) NULL"))
            db.commit()

        # image_url nullable
        db.execute(text("ALTER TABLE banners ALTER COLUMN image_url DROP NOT NULL"))
        db.commit()

        print("✅ 배너 컬럼 마이그레이션 완료")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
