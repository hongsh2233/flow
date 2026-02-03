"""
하단 메뉴(NavMenu) 초기 데이터 마이그레이션

웹 앱 하단/헤더에 표시될 메뉴 항목의 기본 데이터를 생성합니다.
"""
from app.database import SessionLocal
from app.models import NavMenuItem


def run_migration(db=None):
    """하단 메뉴 초기 데이터 생성 (기존 항목이 있으면 스킵)"""
    default_items = [
        {"label": "홈", "icon": "icon_home", "link_type": "page", "link_value": "/", "match_paths": "/", "order_index": 0},
        {"label": "증시일정", "icon": "icon_calendar", "link_type": "page", "link_value": "/schedule", "match_paths": "/schedule", "order_index": 1},
        {"label": "종목자료", "icon": "icon_chat", "link_type": "page", "link_value": "/stock_info", "match_paths": "/stock_info", "order_index": 2},
        {"label": "시황/뉴스", "icon": "icon_article", "link_type": "page", "link_value": "/news", "match_paths": "/news,/report,/global,/disclosure,/post", "order_index": 3},
        {"label": "설정", "icon": "icon_setting", "link_type": "page", "link_value": "/setting", "match_paths": "/setting", "order_index": 4},
    ]

    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        existing = db.query(NavMenuItem).first()
        if existing:
            return

        for item_data in default_items:
            item = NavMenuItem(
                label=item_data["label"],
                icon=item_data["icon"],
                link_type=item_data["link_type"],
                link_value=item_data["link_value"],
                match_paths=item_data["match_paths"],
                order_index=item_data["order_index"],
                is_visible="visible",
            )
            db.add(item)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    run_migration()
