"""
네이버 랭킹 메인 페이지 항목 추가 마이그레이션

메인 페이지에 네이버 랭킹 항목을 추가합니다.
"""
from app.database import SessionLocal
from app.models import MainPageItem
from sqlalchemy import func


def run_migration(db=None):
    """네이버 랭킹 메인 페이지 항목 추가"""
    # DB 세션이 없으면 생성
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        # 기존 항목 확인
        existing = db.query(MainPageItem).filter(
            MainPageItem.component_key == "naver_ranking"
        ).first()
        
        if existing:
            print("⚠️ 네이버 랭킹 항목이 이미 존재합니다.")
            return
        
        # 최대 order_index 가져오기
        max_order = db.query(func.max(MainPageItem.order_index)).scalar()
        if max_order is None:
            max_order = -1
        
        # 네이버 랭킹 항목 추가
        naver_ranking_item = MainPageItem(
            name="네이버 랭킹",
            component_key="naver_ranking",
            order_index=max_order + 1,
            is_visible="visible"
        )
        db.add(naver_ranking_item)
        
        db.commit()
        print("✅ 네이버 랭킹 메인 페이지 항목 추가 완료")
    except Exception as e:
        print(f"❌ 네이버 랭킹 메인 페이지 항목 추가 실패: {e}")
        db.rollback()
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("네이버 랭킹 메인 페이지 항목 추가 시작...")
    run_migration()
    print("항목 추가 완료!")

