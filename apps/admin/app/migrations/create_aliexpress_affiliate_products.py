"""
aliexpress_affiliate_products 테이블 생성 (광고설정 / 어필리에이트 상품)
"""
from sqlalchemy import text

from app.database import SessionLocal


def upgrade():
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS aliexpress_affiliate_products (
                    id SERIAL PRIMARY KEY,
                    platform VARCHAR(32) NOT NULL DEFAULT 'aliexpress',
                    external_product_id VARCHAR(80) NOT NULL,
                    image_url TEXT,
                    video_url TEXT,
                    title VARCHAR(500),
                    original_price VARCHAR(64),
                    sale_price VARCHAR(64),
                    discount_percent VARCHAR(32),
                    currency_code VARCHAR(16) DEFAULT 'KRW',
                    stat_rating_primary VARCHAR(32),
                    stat_commission_primary VARCHAR(64),
                    stat_rating_secondary VARCHAR(32),
                    stat_commission_secondary VARCHAR(64),
                    sold_count VARCHAR(32),
                    feedback_percent VARCHAR(32),
                    affiliate_url TEXT,
                    is_active VARCHAR(20) NOT NULL DEFAULT 'active',
                    order_index INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_affiliate_products_platform ON aliexpress_affiliate_products (platform)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_affiliate_products_ext_id ON aliexpress_affiliate_products (external_product_id)"
            )
        )
        db.commit()
        print("✅ aliexpress_affiliate_products 테이블 생성 완료")
    except Exception as e:
        db.rollback()
        print(f"⚠️ aliexpress_affiliate_products 마이그레이션: {e}")
        raise
    finally:
        db.close()
