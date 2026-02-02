"""
프로필 자동 생성 유틸리티

소셜 로그인 시 자동으로 생성되는 프로필 정보:
- 캐릭터 이름 및 프로필 이미지 (데이터베이스에서 활성화된 캐릭터 중 랜덤 선택)
- 닉네임 (데이터베이스에서 활성화된 주식 관련 단어 중 랜덤 선택 + 랜덤 숫자 6자리)
"""
import random
from sqlalchemy.orm import Session
from app.models import Character, StockWord

# 기본 프로필 이미지 (캐릭터 이미지가 없는 경우)
DEFAULT_PROFILE_IMAGE = "/image/icon/icon_account.svg"


def get_all_characters_from_db(db: Session):
    """
    데이터베이스에서 활성화된 모든 캐릭터 조회
    
    Args:
        db: 데이터베이스 세션
    
    Returns:
        list: 캐릭터 목록 (dict 형태)
    """
    characters = db.query(Character).filter(
        Character.is_active == "active"
    ).order_by(Character.order_index).all()
    
    return [
        {"name": char.name, "image": char.image_url}
        for char in characters
    ]


def get_all_stock_words_from_db(db: Session):
    """
    데이터베이스에서 활성화된 모든 주식 관련 단어 조회
    
    Args:
        db: 데이터베이스 세션
    
    Returns:
        list: 주식 관련 단어 목록
    """
    words = db.query(StockWord).filter(
        StockWord.is_active == "active"
    ).order_by(StockWord.order_index).all()
    
    return [word.word for word in words]


def generate_random_character(db: Session):
    """
    랜덤 캐릭터 선택 (데이터베이스에서)
    
    Args:
        db: 데이터베이스 세션
    
    Returns:
        dict: {"name": "캐릭터 이름", "image": "프로필 이미지 URL"}
    """
    characters = get_all_characters_from_db(db)
    
    if not characters:
        # 데이터베이스에 캐릭터가 없으면 기본값 반환
        return {
            "name": "👤 사용자",
            "image": DEFAULT_PROFILE_IMAGE
        }
    
    return random.choice(characters)


def generate_random_nickname(db: Session):
    """
    랜덤 닉네임 생성 (데이터베이스에서)
    주식 관련 단어 중 랜덤 선택 + 랜덤 숫자 6자리
    
    Args:
        db: 데이터베이스 세션
    
    Returns:
        str: 생성된 닉네임 (예: "투자자123456")
    """
    words = get_all_stock_words_from_db(db)
    
    if not words:
        # 데이터베이스에 단어가 없으면 기본값 사용
        word = "투자자"
    else:
        word = random.choice(words)
    
    random_number = random.randint(100000, 999999)
    return f"{word}{random_number}"


def generate_profile(db: Session):
    """
    전체 프로필 생성 (데이터베이스 기반)
    
    Args:
        db: 데이터베이스 세션
    
    Returns:
        dict: {
            "name": "캐릭터 이름",
            "nickname": "생성된 닉네임",
            "profile_image": "프로필 이미지 URL"
        }
    """
    character = generate_random_character(db)
    nickname = generate_random_nickname(db)
    
    return {
        "name": character["name"],
        "nickname": nickname,
        "profile_image": character["image"]
    }


def get_all_characters():
    """
    모든 캐릭터 목록 반환 (하위 호환성을 위한 함수)
    주의: 이 함수는 더 이상 사용하지 않으며, get_all_characters_from_db를 사용해야 합니다.
    
    Returns:
        list: 빈 리스트 (더 이상 사용하지 않음)
    """
    return []
