"""
메인 페이지 설정 항목 초기화 마이그레이션

메인 페이지에 표시될 항목들의 초기 데이터를 생성합니다.
"""
from app.database import SessionLocal
from app.models import MainPageItem


def run_migration(db=None):
    """메인 페이지 항목 초기 데이터 생성"""
    # 기본 항목 정의
    default_items = [
        {"name": "상단배너관리", "component_key": "top_banner", "order_index": 0, "is_visible": "visible"},
        {"name": "해외지수", "component_key": "foreign_indices", "order_index": 1, "is_visible": "visible"},
        {"name": "지수현황", "component_key": "domestic_indices", "order_index": 2, "is_visible": "visible"},
        {"name": "배너관리", "component_key": "banner", "order_index": 3, "is_visible": "visible"},
        {"name": "관심종목", "component_key": "favorite_stocks", "order_index": 4, "is_visible": "visible"},
        {"name": "뉴스관리", "component_key": "news", "order_index": 5, "is_visible": "visible"},
        {"name": "글로벌", "component_key": "global_board", "order_index": 6, "is_visible": "visible"},
    ]
    
    # DB 세션이 없으면 생성
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        # 기존 항목이 있으면 스킵
        existing_items = db.query(MainPageItem).all()
        if existing_items:
            print("⚠️ 메인 페이지 항목이 이미 존재합니다. 초기화를 건너뜁니다.")
            return
        
        # 항목 생성
        for item_data in default_items:
            item = MainPageItem(
                name=item_data["name"],
                component_key=item_data["component_key"],
                order_index=item_data["order_index"],
                is_visible=item_data["is_visible"]
            )
            db.add(item)
        
        db.commit()
        print("✅ 메인 페이지 항목 초기 데이터 생성 완료")
    except Exception as e:
        print(f"❌ 메인 페이지 항목 초기 데이터 생성 실패: {e}")
        db.rollback()
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("메인 페이지 항목 초기 데이터 생성 시작...")
    run_migration()
    print("초기 데이터 생성 완료!")

