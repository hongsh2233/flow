"""
환율 항목 추가 마이그레이션

기존 메인 페이지 설정에 환율 항목을 추가합니다.
"""
from app.database import SessionLocal
from app.models import MainPageItem
from sqlalchemy import func


def run_migration(db=None):
    """환율 항목 추가"""
    # DB 세션이 없으면 생성
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        # 이미 존재하는지 확인
        existing_exchange = db.query(MainPageItem).filter(
            MainPageItem.component_key == "exchange_rate"
        ).first()
        
        if existing_exchange:
            print("⚠️ 환율 항목이 이미 존재합니다.")
            return
        
        # 최대 order_index 가져오기
        max_order = db.query(func.max(MainPageItem.order_index)).scalar()
        if max_order is None:
            max_order = -1
        
        # 환율 항목 생성
        exchange_item = MainPageItem(
            name="환율",
            component_key="exchange_rate",
            order_index=max_order + 1,
            is_visible="visible"
        )
        db.add(exchange_item)
        db.commit()
        
        print(f"✅ 환율 항목이 추가되었습니다. (order_index: {max_order + 1})")
    except Exception as e:
        print(f"❌ 환율 항목 추가 실패: {e}")
        db.rollback()
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("환율 항목 추가 마이그레이션 시작...")
    run_migration()
    print("마이그레이션 완료!")

