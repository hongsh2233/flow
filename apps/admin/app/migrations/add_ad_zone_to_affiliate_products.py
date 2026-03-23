"""
aliexpress_affiliate_products 테이블에 ad_zone 컬럼 추가

광고 구역 구분:
  NULL 또는 "A" → A구역 (기존 제휴 상품)
  "B"           → B구역 (신규 슬롯)
"""
from sqlalchemy import text
from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                ALTER TABLE aliexpress_affiliate_products
                ADD COLUMN IF NOT EXISTS ad_zone VARCHAR(20) NULL
                """
            )
        )
        db.commit()
        print("✅ aliexpress_affiliate_products.ad_zone 컬럼 추가 완료")
    except Exception as e:
        db.rollback()
        print(f"⚠️ add_ad_zone_to_affiliate_products 마이그레이션: {e}")
        raise
    finally:
        db.close()
