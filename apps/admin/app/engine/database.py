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

# .env 파일 로드 (apps/admin 기준)
_base = Path(__file__).resolve().parent.parent.parent.parent  # apps/admin
env_file = _base / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

# 환경 변수에서 DB 접속 정보 가져오기 (PostgreSQL 기본값)
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "stock_bo")

# PostgreSQL 연결 URL
# 형식: postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

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
