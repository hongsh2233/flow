"""
admin_users 테이블에 is_super_admin 컬럼 추가 마이그레이션

기존에 .env의 ADMIN_EMAIL로 최고 관리자를 판별하던 방식을 DB 기반으로 개선.
마이그레이션 실행 시 ADMIN_EMAIL 환경 변수에 해당하는 계정을 최고 관리자로 설정.
"""
import os
from sqlalchemy import text
from app.database import engine


def upgrade():
    """
    admin_users 테이블에 is_super_admin 컬럼 추가 및
    기존 관리자 계정 중 ADMIN_EMAIL과 일치하는 계정을 최고 관리자로 설정.
    """
    with engine.connect() as conn:
        try:
            # is_super_admin 컬럼이 이미 존재하는지 확인
            check_query = text("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'admin_users'
                AND column_name = 'is_super_admin'
            """)
            result = conn.execute(check_query)
            exists = result.scalar() > 0

            if not exists:
                # is_super_admin 컬럼 추가
                conn.execute(text("""
                    ALTER TABLE admin_users
                    ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE
                """))
                conn.commit()
                print("✅ admin_users 테이블에 is_super_admin 컬럼 추가 완료")
            else:
                print("ℹ️ admin_users 테이블에 is_super_admin 컬럼이 이미 존재합니다.")

            # ADMIN_EMAIL 환경 변수에 해당하는 계정을 최고 관리자로 설정
            admin_email = os.environ.get("ADMIN_EMAIL")
            if admin_email:
                update_result = conn.execute(
                    text("UPDATE admin_users SET is_super_admin = TRUE WHERE email = :email"),
                    {"email": admin_email},
                )
                conn.commit()
                if update_result.rowcount > 0:
                    print(f"✅ 최고 관리자 설정 완료: {admin_email}")
                else:
                    print(f"ℹ️ ADMIN_EMAIL({admin_email})에 해당하는 계정 없음. 초기화 시 자동 설정됩니다.")
            else:
                # ADMIN_EMAIL이 없으면 첫 번째 관리자를 최고 관리자로 설정
                first_admin = conn.execute(
                    text("SELECT id FROM admin_users ORDER BY id ASC LIMIT 1")
                ).fetchone()
                if first_admin:
                    conn.execute(
                        text("UPDATE admin_users SET is_super_admin = TRUE WHERE id = :id"),
                        {"id": first_admin[0]},
                    )
                    conn.commit()
                    print("✅ 첫 번째 관리자를 최고 관리자로 설정 완료")
        except Exception as e:
            print(f"⚠️ is_super_admin 컬럼 추가 중 오류 발생: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    upgrade()
