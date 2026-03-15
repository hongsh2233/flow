"""
게시글 회원전용 기간 설정 컬럼 추가
- member_only_start_date: 제한 시작일 (null=즉시)
- member_only_end_date: 제한 종료일 (null=무기한)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'member_only_start_date'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                ALTER TABLE posts ADD COLUMN member_only_start_date DATE
            """))
            db.commit()
            print("✅ posts.member_only_start_date 컬럼 추가 완료")
        else:
            print("ℹ️ member_only_start_date 컬럼이 이미 존재합니다.")

        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'member_only_end_date'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                ALTER TABLE posts ADD COLUMN member_only_end_date DATE
            """))
            db.commit()
            print("✅ posts.member_only_end_date 컬럼 추가 완료")
        else:
            print("ℹ️ member_only_end_date 컬럼이 이미 존재합니다.")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
