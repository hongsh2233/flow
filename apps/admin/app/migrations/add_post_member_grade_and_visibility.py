"""
게시글에 회원등급 지정(member_only_grade) 및 전체공개 시 노출 방식(public_visibility) 컬럼 추가
- member_only_grade: 회원전용일 때 'all'|'vip'|'family' (all=전체회원, vip=VIP이상, family=FAMILY만)
- public_visibility: 전체공개일 때 'full'|'partial' (full=전체노출, partial=50자+회원가입유도)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        # member_only_grade 컬럼
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'member_only_grade'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                ALTER TABLE posts ADD COLUMN member_only_grade VARCHAR(20) DEFAULT 'all'
            """))
            db.commit()
            print("✅ posts.member_only_grade 컬럼 추가 완료")
        else:
            print("ℹ️ member_only_grade 컬럼이 이미 존재합니다.")

        # public_visibility 컬럼
        r = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'public_visibility'
        """))
        if r.fetchone() is None:
            db.execute(text("""
                ALTER TABLE posts ADD COLUMN public_visibility VARCHAR(20) DEFAULT 'full'
            """))
            db.commit()
            print("✅ posts.public_visibility 컬럼 추가 완료")
        else:
            print("ℹ️ public_visibility 컬럼이 이미 존재합니다.")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
