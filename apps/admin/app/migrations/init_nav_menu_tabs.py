"""
메뉴별 서브 메뉴(탭) 초기 데이터 마이그레이션

'뉴스' 메뉴에 기본 탭(전체뉴스, 관심뉴스)을 추가합니다.
"""
from app.database import SessionLocal
from app.models import NavMenuItem, NavMenuTab


def run_migration(db=None):
    """뉴스 메뉴에 기본 탭 추가 (이미 있으면 스킵)"""
    default_tabs = [
        {"label": "전체뉴스", "link_value": "/news", "order_index": 0},
        {"label": "관심뉴스", "link_value": "/news?tab=favorite", "order_index": 1},
    ]

    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        parent = db.query(NavMenuItem).filter(
            (NavMenuItem.link_value == "/news") | (NavMenuItem.label == "뉴스")
        ).first()
        if not parent:
            return

        existing = db.query(NavMenuTab).filter(NavMenuTab.nav_menu_item_id == parent.id).first()
        if existing:
            return

        for tab_data in default_tabs:
            tab = NavMenuTab(
                nav_menu_item_id=parent.id,
                label=tab_data["label"],
                link_value=tab_data["link_value"],
                order_index=tab_data["order_index"],
                is_visible="visible",
            )
            db.add(tab)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    run_migration()
