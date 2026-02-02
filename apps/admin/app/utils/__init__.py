"""
유틸리티 함수 모듈

기존 utils.py의 내용을 여기로 옮겨서 utils 패키지로 통합했습니다.
"""
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_HOURS, JWT_REFRESH_TOKEN_EXPIRE_DAYS

# bcrypt 알고리즘 사용 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    """입력받은 비번과 DB의 해시 비번이 일치하는지 확인"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """비밀번호를 암호화하여 리턴"""
    return pwd_context.hash(password)

# JWT 토큰 관련 함수
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT 액세스 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """JWT 토큰 검증 및 페이로드 반환"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def create_refresh_token() -> str:
    """Refresh Token 생성 (랜덤 문자열)"""
    import secrets
    return secrets.token_urlsafe(32)  # 32바이트 랜덤 문자열을 URL-safe base64로 인코딩

