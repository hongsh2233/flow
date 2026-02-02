"""
기존 캐릭터 이미지 경로를 /image/characters/에서 /static/image/characters/로 업데이트하는 마이그레이션
"""
from app.database import SessionLocal
from app.models import Character
from sqlalchemy import text


def migrate_character_image_paths():
    """기존 캐릭터 이미지 경로를 /static/image/로 업데이트"""
    db = SessionLocal()
    try:
        # UPDATE 쿼리로 모든 캐릭터의 image_url 업데이트
        db.execute(
            text("""
                UPDATE characters
                SET image_url = REPLACE(image_url, '/image/characters/', '/static/image/characters/')
                WHERE image_url LIKE '/image/characters/%'
            """)
        )
        db.commit()
        print("✅ 캐릭터 이미지 경로 업데이트 완료: /image/ → /static/image/")

    except Exception as e:
        print(f"⚠️ 캐릭터 이미지 경로 업데이트 중 오류 (무시 가능): {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("캐릭터 이미지 경로 업데이트 시작...")
    migrate_character_image_paths()
    print("업데이트 완료!")
