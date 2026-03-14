"""
B002 시황자료 게시판 및 '목표가 조정' 카테고리 초기화
- B002가 없으면 생성 (use_categories=true)
- '목표가 조정' 카테고리가 없으면 생성
"""
from app.database import SessionLocal
from app.engine.models import Board, BoardCategory


def upgrade():
    db = SessionLocal()
    try:
        board = db.query(Board).filter(Board.id == "B002").first()
        if not board:
            db.add(Board(
                id="B002",
                name="시황자료",
                type="board",
                auth="all",
                use_categories="true",
            ))
            db.flush()
            print("B002 시황자료 게시판 생성 완료")
        else:
            # 카테고리 사용 활성화
            if board.use_categories != "true":
                board.use_categories = "true"
                print("B002 use_categories 활성화")

        cat = (
            db.query(BoardCategory)
            .filter(
                BoardCategory.board_id == "B002",
                BoardCategory.name == "목표가 조정",
            )
            .first()
        )
        if not cat:
            max_order = (
                db.query(BoardCategory)
                .filter(BoardCategory.board_id == "B002")
                .count()
            )
            db.add(BoardCategory(
                board_id="B002",
                name="목표가 조정",
                order_index=max_order,
            ))
            print("B002 '목표가 조정' 카테고리 생성 완료")
        else:
            print("B002 '목표가 조정' 카테고리가 이미 존재합니다.")

        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
