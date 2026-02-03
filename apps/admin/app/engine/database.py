"""
데이터베이스 연결 설정 (PostgreSQL)

SQLAlchemy를 사용하여 PostgreSQL 데이터베이스 연결을 설정합니다.
환경 변수(.env 파일)에서 데이터베이스 접속 정보를 읽어옵니다.

환경 변수:
    DB_USER: 데이터베이스 사용자명 (기본값: 'postgres')
    DB_PASSWORD: 데이터베이스 비밀번호
    DB_HOST: 데이터베이스 호스트 (기본값: 'localhost')
    DB_PORT: 데이터베이스 포트 (기본값: '5432')
    DB_NAME: 데이터베이스 이름 (기본값: 'stock_bo')
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# .env 로드: 1) 루트 .env.local, 2) apps/admin/.env
_admin_dir = Path(__file__).resolve().parent.parent.parent  # apps/admin
_root = _admin_dir.parent.parent  # jurin-i 루트
_env_local = _root / ".env.local"
_env_file = _admin_dir / ".env"
if _env_local.exists():
    load_dotenv(dotenv_path=_env_local)
if _env_file.exists():
    load_dotenv(dotenv_path=_env_file)
if not _env_local.exists() and not _env_file.exists():
    load_dotenv()

# 환경 변수에서 DB 접속 정보 가져오기 (PostgreSQL 기본값)
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "stock_bo")

# PostgreSQL 연결 URL
# 형식: postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}
# Railway 공개 호스트(rlwy.net)는 SSL 필요
_raw_url = os.getenv("DATABASE_URL")
if _raw_url:
    # DATABASE_URL이 postgresql:// 이면 psycopg2용으로 변환
    if _raw_url.startswith("postgresql://") and "+" not in _raw_url.split("?")[0]:
        _raw_url = _raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    SQLALCHEMY_DATABASE_URL = _raw_url
else:
    _base = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    SQLALCHEMY_DATABASE_URL = f"{_base}?sslmode=require" if "rlwy.net" in str(DB_HOST) else _base

# 데이터베이스 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_recycle=3600,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 의존성 주입용 DB 세션."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
