"""
FastAPI 애플리케이션 메인 파일

이 파일은 FastAPI 애플리케이션의 진입점입니다.
서버 시작 시 다음 작업을 수행합니다:
    1. 데이터베이스 테이블 생성
    2. 마이그레이션 실행
    3. 초기 관리자 계정 생성
    4. 라우터 등록
    5. 정적 파일 서빙 설정
    6. CORS 설정
    7. FSC 데이터 수집 스케줄러 시작
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os

from app import models
from app.database import engine, get_db
from app import utils
from app.config import ADMIN_EMAIL, ADMIN_PW
from app.services.scheduler_service import fsc_scheduler, krx_scheduler, naver_ranking_scheduler

# 라우터 import
from app.routers import auth, dashboard, admin, members, board, schedule, finance, fsc, api
try:
    from app.routers import profile
except ImportError as e:
    print(f"⚠️ profile 라우터 import 실패 (무시 가능): {e}")
    profile = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 생명주기 관리

    시작: 스케줄러 시작
    종료: 스케줄러 종료
    """
    # 시작 시
    print("\n🚀 애플리케이션 시작")
    fsc_scheduler.start()
    krx_scheduler.start()
    naver_ranking_scheduler.start()
    yield
    # 종료 시
    print("\n🛑 애플리케이션 종료")
    fsc_scheduler.shutdown()
    krx_scheduler.shutdown()
    naver_ranking_scheduler.shutdown()


# FastAPI 앱 생성
app = FastAPI(
    title="Stock BO API",
    description="게시판 및 일정 관리, 금융 데이터 조회 REST API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정 (프론트엔드에서 API 호출 허용)
# 프로덕션 환경에서는 allow_origins를 특정 도메인으로 제한해야 합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 도메인 허용 (개발용)
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# 정적 파일 서빙 설정
# uploads 디렉토리: 업로드된 이미지 및 파일
# 디렉토리가 없으면 생성
uploads_dir = "uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
    # 하위 디렉토리도 생성
    for subdir in ["banners", "images", "files"]:
        subdir_path = os.path.join(uploads_dir, subdir)
        if not os.path.exists(subdir_path):
            os.makedirs(subdir_path, exist_ok=True)

if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# dashboard/static: JavaScript, CSS 등 정적 리소스 (캐릭터 이미지 포함)
if os.path.exists("dashboard/static"):
    app.mount("/static", StaticFiles(directory="dashboard/static"), name="static")

# 데이터베이스 초기화: 서버 시작 시 테이블 생성
# models.py에 정의된 모든 모델의 테이블이 자동으로 생성됩니다.
# 연결 실패 시에도 서버는 시작되도록 예외 처리
try:
    models.Base.metadata.create_all(bind=engine)
    print("✅ 데이터베이스 테이블 생성 완료")
except Exception as e:
    print(f"⚠️ 데이터베이스 연결 실패: {e}")
    print("💡 PostgreSQL 서버가 실행 중인지 확인하세요: docker-compose up -d db")


def run_migrations():
    """
    데이터베이스 마이그레이션 실행
    
    기존 테이블에 컬럼을 추가하거나 수정하는 작업을 수행합니다.
    마이그레이션 실패는 무시됩니다 (이미 적용된 경우).
    """
    try:
        from app.migrations.add_schedule_columns import migrate_schedule_table
        migrate_schedule_table()
    except Exception as e:
        print(f"⚠️ 일정 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_member_columns import migrate_member_table
        migrate_member_table()
    except Exception as e:
        print(f"⚠️ 회원 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_favorite_stocks_column import upgrade
        upgrade()
    except Exception as e:
        print(f"⚠️ 관심종목 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.init_characters_and_words import init_characters_and_words
        init_characters_and_words()
    except Exception as e:
        print(f"⚠️ 캐릭터 및 주식 단어 초기 데이터 삽입 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.init_main_page_items import run_migration
        from app.database import SessionLocal
        db = SessionLocal()
        run_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 메인 페이지 항목 초기 데이터 삽입 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_global_board_item import run_migration as add_global_migration
        from app.database import SessionLocal
        db = SessionLocal()
        add_global_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 글로벌 게시판 항목 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_main_page_item_columns import run_migration as add_main_page_columns_migration
        from app.database import SessionLocal
        db = SessionLocal()
        add_main_page_columns_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 메인 페이지 항목 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_exchange_rate_item import run_migration as add_exchange_migration
        from app.database import SessionLocal
        db = SessionLocal()
        add_exchange_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 환율 항목 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_repeat_columns import run_migration as add_repeat_columns_migration
        from app.database import SessionLocal
        db = SessionLocal()
        add_repeat_columns_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 반복 설정 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.update_character_image_paths import migrate_character_image_paths
        migrate_character_image_paths()
    except Exception as e:
        print(f"⚠️ 캐릭터 이미지 경로 업데이트 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_post_secret_column import upgrade
        upgrade()
    except Exception as e:
        print(f"⚠️ 게시글 비밀글 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_naver_stock_ranking import upgrade as add_naver_ranking_migration
        add_naver_ranking_migration()
    except Exception as e:
        print(f"⚠️ 네이버 증권 랭킹 테이블 생성 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_naver_ranking_item import run_migration as add_naver_ranking_item_migration
        from app.database import SessionLocal
        db = SessionLocal()
        add_naver_ranking_item_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 네이버 랭킹 메인 페이지 항목 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")


def init_admin_user():
    """
    초기 관리자 계정 자동 생성
    
    환경 변수에 관리자 이메일과 비밀번호가 설정되어 있고,
    해당 이메일의 관리자가 없을 경우 자동으로 생성합니다.
    DB 연결 실패 시에도 앱은 시작되도록 예외 처리합니다.
    """
    try:
        db = next(get_db())
        try:
            if ADMIN_EMAIL and ADMIN_PW:
                existing_user = db.query(models.AdminUser).filter(
                    models.AdminUser.email == ADMIN_EMAIL
                ).first()
                
                if not existing_user:
                    # 보안: 관리자 이메일은 콘솔에 출력하지 않음
                    print(f"⚠️ 초기 관리자 계정 생성 중")
                    hashed_pw = utils.get_password_hash(ADMIN_PW)
                    new_admin = models.AdminUser(
                        email=ADMIN_EMAIL,
                        name="최고관리자",
                        hashed_password=hashed_pw
                    )
                    db.add(new_admin)
                    db.commit()
                    print("✅ 초기 관리자 생성 완료")
        except Exception as e:
            print(f"❌ 초기 관리자 생성 실패: {e}")
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️ DB 연결 실패 (로그인/관리자 초기화 불가): {e}")
        print("💡 .env.local 의 DB_HOST(호스트만), DB_PORT, DATABASE_URL, SSL(sslmode=require) 확인")


# 서버 시작 시 초기화 작업 실행
run_migrations()  # 마이그레이션 실행
init_admin_user()  # 초기 관리자 계정 생성

# 라우터 등록
# 각 라우터는 특정 기능 영역의 엔드포인트를 담당합니다.
app.include_router(auth.router)      # 인증 (로그인/로그아웃)
app.include_router(dashboard.router)  # 대시보드
app.include_router(admin.router)    # 관리자 관리
app.include_router(members.router)   # 회원 관리
app.include_router(board.router)     # 게시판 관리
app.include_router(schedule.router)  # 일정 관리
app.include_router(finance.router)   # 한국거래소 데이터
app.include_router(fsc.router)       # 금융위원회 데이터
app.include_router(api.router)       # REST API (외부 호출용)
if profile:
    app.include_router(profile.router)   # 프로필 설정 관리 (캐릭터, 주식 단어)
