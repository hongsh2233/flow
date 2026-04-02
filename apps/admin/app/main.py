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
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from app import models
from app.database import engine, get_db, SessionLocal
from app import utils
from app.config import ADMIN_EMAIL, ADMIN_PW, BASE_DIR, UPLOADS_DIR
from app.services.scheduler_service import fsc_scheduler, krx_scheduler, naver_ranking_scheduler, yahoo_index_scheduler, exchange_rate_scheduler, naver_supply_scheduler, naver_news_scheduler, investment_bank_news_scheduler, target_price_news_scheduler, naver_rising_scheduler, stock_screening_scheduler, jongbe_screening_scheduler
from app.engine.services.scheduler_service import schedule_alarm_scheduler, calendar_scheduler

# 라우터 import
from app.routers import auth, dashboard, admin, members, board, schedule, polls, finance, fsc, api, faq, terms, popup, broker, ad_settings
try:
    from app.routers import profile
except ImportError as e:
    print(f"⚠️ profile 라우터 import 실패 (무시 가능): {e}")
    profile = None

try:
    from app.routers import stock_terms
except ImportError as e:
    print(f"⚠️ stock_terms 라우터 import 실패 (무시 가능): {e}")
    stock_terms = None

try:
    from app.routers import master_quotes
except ImportError as e:
    print(f"⚠️ master_quotes 라우터 import 실패 (무시 가능): {e}")
    master_quotes = None

try:
    from app.routers import market_voices
except ImportError as e:
    print(f"⚠️ market_voices 라우터 import 실패 (무시 가능): {e}")
    market_voices = None

try:
    from app.routers import investment_bank_news
except ImportError as e:
    print(f"⚠️ investment_bank_news 라우터 import 실패 (무시 가능): {e}")
    investment_bank_news = None

try:
    from app.routers import target_price_news
except ImportError as e:
    print(f"⚠️ target_price_news 라우터 import 실패 (무시 가능): {e}")
    target_price_news = None


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
    naver_supply_scheduler.start()
    yahoo_index_scheduler.start()
    exchange_rate_scheduler.start()
    schedule_alarm_scheduler.start()
    calendar_scheduler.start()
    naver_news_scheduler.start()
    investment_bank_news_scheduler.start()
    target_price_news_scheduler.start()
    naver_rising_scheduler.start()
    stock_screening_scheduler.start()
    jongbe_screening_scheduler.start()
    yield
    # 종료 시
    print("\n🛑 애플리케이션 종료")
    fsc_scheduler.shutdown()
    krx_scheduler.shutdown()
    naver_ranking_scheduler.shutdown()
    naver_supply_scheduler.shutdown()
    yahoo_index_scheduler.shutdown()
    exchange_rate_scheduler.shutdown()
    schedule_alarm_scheduler.shutdown()
    calendar_scheduler.shutdown()
    naver_news_scheduler.shutdown()
    investment_bank_news_scheduler.shutdown()
    target_price_news_scheduler.shutdown()
    naver_rising_scheduler.shutdown()
    stock_screening_scheduler.shutdown()
    jongbe_screening_scheduler.shutdown()



# Rate Limiter (IP 기반)
limiter = Limiter(key_func=get_remote_address)

# FastAPI 앱 생성
app = FastAPI(
    title="Stock BO API",
    description="게시판 및 일정 관리, 금융 데이터 조회 REST API",
    version="1.0.0",
    lifespan=lifespan
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# robots.txt: BO(관리자) 영역 검색엔진 색인 차단
@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt():
    """검색엔진 봇에 관리자 전체 영역 차단 지시"""
    return """User-agent: *
Disallow: /
"""

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# CORS 설정 (프론트엔드에서 API 호출 허용)
# Railway 배포 시: ALLOWED_ORIGINS=https://jurin-i-web.up.railway.app,https://jurin-i.com,... 설정
# 주의: Railway Variables에 따옴표 없이 값만 입력 (따옴표 포함 시 파싱 오류로 CORS 실패)
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [
    o.strip().strip('"\'')  # 따옴표 제거 (Railway 등에서 "..." 형태로 저장된 경우 대비)
    for o in _raw_origins.split(",")
    if o.strip()
]
if os.environ.get("RAILWAY_ENVIRONMENT") and not ALLOWED_ORIGINS:
    print("⚠️ CORS: ALLOWED_ORIGINS가 비어있습니다. 프론트엔드 API 호출이 차단됩니다.")
    print("   Railway Variables에 ALLOWED_ORIGINS=https://your-web-domain.com 형식으로 설정하세요.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-KEY"],
)

# 정적 파일 서빙 설정 (UPLOADS_DIR 사용 → 빌드/실행 경로와 무관하게 이미지 정상 노출)
uploads_dir = str(UPLOADS_DIR)
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
for subdir in ["banners", "images", "files", "popups"]:
    subdir_path = os.path.join(uploads_dir, subdir)
    if not os.path.exists(subdir_path):
        os.makedirs(subdir_path, exist_ok=True)

if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# dashboard/static: JavaScript, CSS 등 정적 리소스 (캐릭터 이미지 포함)
dashboard_static = BASE_DIR / "dashboard" / "static"
if dashboard_static.exists():
    app.mount("/static", StaticFiles(directory=str(dashboard_static)), name="static")

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
        from app.migrations.add_schedule_detail_column import migrate_schedule_detail
        migrate_schedule_detail()
    except Exception as e:
        print(f"⚠️ 일정 detail 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_schedule_time_column import migrate_schedule_time
        migrate_schedule_time()
    except Exception as e:
        print(f"⚠️ 일정 scheduled_time 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_schedule_link_url_underwriter import upgrade as add_schedule_link_url_underwriter
        add_schedule_link_url_underwriter()
    except Exception as e:
        print(f"⚠️ 일정 link_url/underwriter 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
    try:
        from app.migrations.add_member_columns import migrate_member_table
        migrate_member_table()
    except Exception as e:
        print(f"⚠️ 회원 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_member_password_column import run_migration as add_member_password_migration
        add_member_password_migration()
    except Exception as e:
        print(f"⚠️ 회원 비밀번호 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.alter_member_provider_id_nullable import run_migration as alter_provider_id_migration
        alter_provider_id_migration()
    except Exception as e:
        print(f"⚠️ provider_id NULL 허용 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_favorite_stocks_column import upgrade
        upgrade()
    except Exception as e:
        print(f"⚠️ 관심종목 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_jubti_type_column import upgrade as upgrade_jubti_type
        upgrade_jubti_type()
    except Exception as e:
        print(f"⚠️ 주BTI(jubti_type) 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

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
        from app.migrations.add_post_member_only_column import upgrade
        upgrade()
    except Exception as e:
        print(f"⚠️ 게시글 회원전용 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_post_member_grade_and_visibility import upgrade as add_post_grade_visibility
        add_post_grade_visibility()
    except Exception as e:
        print(f"⚠️ 게시글 등급/노출 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_post_member_only_period import upgrade as add_post_member_only_period
        add_post_member_only_period()
    except Exception as e:
        print(f"⚠️ 게시글 회원전용 기간 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")
    
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

    try:
        from app.migrations.init_nav_menu_items import run_migration as init_nav_menu_migration
        from app.database import SessionLocal
        db = SessionLocal()
        init_nav_menu_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 하단 메뉴 초기 데이터 삽입 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.init_nav_menu_tabs import run_migration as init_nav_menu_tabs_migration
        from app.database import SessionLocal
        db = SessionLocal()
        init_nav_menu_tabs_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 메뉴 탭 초기 데이터 삽입 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_tab_link_type_column import run_migration as add_tab_link_type_migration
        from app.database import SessionLocal
        db = SessionLocal()
        add_tab_link_type_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ 탭 link_type 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_yahoo_indices_tables import run_migration as add_yahoo_indices_tables
        from app.database import SessionLocal
        db = SessionLocal()
        add_yahoo_indices_tables(db)
        db.close()
    except Exception as e:
        print(f"⚠️ Yahoo 지수 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_board_categories import upgrade as add_board_categories_migration
        add_board_categories_migration()
    except Exception as e:
        print(f"⚠️ 게시판 카테고리 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_board_random_view_boost import upgrade as add_board_random_view_boost_migration
        add_board_random_view_boost_migration()
    except Exception as e:
        print(f"⚠️ boards.random_view_boost 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.init_faq_and_legal import run_migration as init_faq_legal_migration
        from app.database import SessionLocal
        db = SessionLocal()
        init_faq_legal_migration(db)
        db.close()
    except Exception as e:
        print(f"⚠️ FAQ 및 약관 초기 데이터 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_banner_columns import upgrade as add_banner_columns_migration
        add_banner_columns_migration()
    except Exception as e:
        print(f"⚠️ 배너 컬럼 추가 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_banner_display_position import upgrade as add_banner_display_position_migration
        add_banner_display_position_migration()
    except Exception as e:
        print(f"⚠️ 배너 display_position 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_banner_position_column import upgrade as add_banner_position_migration
        add_banner_position_migration()
    except Exception as e:
        print(f"⚠️ 배너 position 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_exchange_rate_snapshot import run_migration as exchange_rate_migration
        exchange_rate_migration()
    except Exception as e:
        print(f"⚠️ 환율 스냅샷 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_schedule_end_date_column import upgrade as add_schedule_end_date_migration
        add_schedule_end_date_migration()
    except Exception as e:
        print(f"⚠️ 일정 end_date 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_schedule_show_main_popup import migrate as add_schedule_show_main_popup_migration
        add_schedule_show_main_popup_migration()
    except Exception as e:
        print(f"⚠️ 일정 show_main_popup 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_member_grade_columns import upgrade as add_member_grade_migration
        add_member_grade_migration()
    except Exception as e:
        print(f"⚠️ 회원 등급 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_schedule_alarm_subscriptions import upgrade as add_schedule_alarm_migration
        add_schedule_alarm_migration()
    except Exception as e:
        print(f"⚠️ 일정 알림 신청 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_member_fcm_tokens import upgrade as add_fcm_tokens_migration
        add_fcm_tokens_migration()
    except Exception as e:
        print(f"⚠️ FCM 토큰 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.alter_fcm_tokens_anonymous import upgrade as alter_fcm_tokens_migration
        alter_fcm_tokens_migration()
    except Exception as e:
        print(f"⚠️ FCM 토큰 비로그인 지원 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_notification_target_email import upgrade as add_notification_target_email_migration
        add_notification_target_email_migration()
    except Exception as e:
        print(f"⚠️ 알림 target_email 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_naver_supply_data import upgrade as add_naver_supply_migration
        add_naver_supply_migration()
    except Exception as e:
        print(f"⚠️ 네이버 수급 동향 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_polls_tables import upgrade as add_polls_migration
        add_polls_migration()
    except Exception as e:
        print(f"⚠️ 투표(polls) 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_poll_vote_records import upgrade as add_poll_vote_records_migration
        add_poll_vote_records_migration()
    except Exception as e:
        print(f"⚠️ poll_vote_records 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_naver_stock_news import upgrade as add_naver_stock_news_migration
        add_naver_stock_news_migration()
    except Exception as e:
        print(f"⚠️ 네이버 주가 영향 뉴스 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_person_master_and_market_voices import upgrade as add_person_master_market_voices_migration
        add_person_master_market_voices_migration()
    except Exception as e:
        print(f"⚠️ person_master/market_voices 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_admin_super_flag import upgrade as add_admin_super_flag_migration
        add_admin_super_flag_migration()
    except Exception as e:
        print(f"⚠️ admin_users is_super_admin 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_master_quote_likes import upgrade as add_master_quote_likes_migration
        add_master_quote_likes_migration()
    except Exception as e:
        print(f"⚠️ master_quote_likes 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_market_morning_ai_summary import upgrade as add_morning_ai_summary_migration
        add_morning_ai_summary_migration()
    except Exception as e:
        print(f"⚠️ market_morning_ai_summaries 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_morning_summary_new_fields import upgrade as add_morning_summary_new_fields_migration
        add_morning_summary_new_fields_migration()
    except Exception as e:
        print(f"⚠️ morning_summary overnight_issues/today_schedule 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_daily_issue_summary import upgrade as add_daily_issue_summary_migration
        add_daily_issue_summary_migration()
    except Exception as e:
        print(f"⚠️ daily_issue_summaries 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_supply_summary_ai_summary import upgrade as add_supply_summary_ai_migration
        add_supply_summary_ai_migration()
    except Exception as e:
        print(f"⚠️ supply_summary_ai_summaries 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_supply_summary_ai_market import upgrade as add_supply_summary_ai_market_migration
        add_supply_summary_ai_market_migration()
    except Exception as e:
        print(f"⚠️ supply_summary_ai market 컬럼 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_investment_bank_news import upgrade as add_investment_bank_news_migration
        add_investment_bank_news_migration()
    except Exception as e:
        print(f"⚠️ investment_bank_news 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_post_show_on_main import upgrade as add_post_show_on_main_migration
        add_post_show_on_main_migration()
    except Exception as e:
        print(f"⚠️ posts show_on_main 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_b002_target_price_board import upgrade as add_b002_target_price_migration
        add_b002_target_price_migration()
    except Exception as e:
        print(f"⚠️ B002 목표가 조정 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_post_status_column import upgrade as add_post_status_migration
        add_post_status_migration()
    except Exception as e:
        print(f"⚠️ posts status 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_password_reset_codes import upgrade as add_password_reset_codes_migration
        add_password_reset_codes_migration()
    except Exception as e:
        print(f"⚠️ password_reset_codes 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_login_attempts import upgrade as add_login_attempts_migration
        add_login_attempts_migration()
    except Exception as e:
        print(f"⚠️ login_attempts 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.create_naver_rising_stock import migrate as create_naver_rising_stock_migration
        create_naver_rising_stock_migration()
    except Exception as e:
        print(f"⚠️ naver_rising_stock 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.create_aliexpress_affiliate_products import upgrade as create_affiliate_products_migration
        create_affiliate_products_migration()
    except Exception as e:
        print(f"⚠️ aliexpress_affiliate_products 테이블 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_ad_zone_to_affiliate_products import upgrade as add_ad_zone_migration
        add_ad_zone_migration()
    except Exception as e:
        print(f"⚠️ add_ad_zone 마이그레이션 실행 중 오류 (무시 가능): {e}")

    try:
        from app.migrations.add_domestic_index_snapshots import run_migration as add_domestic_index_snapshots_migration
        add_domestic_index_snapshots_migration()
    except Exception as e:
        print(f"⚠️ domestic_index_snapshots 마이그레이션 실행 중 오류 (무시 가능): {e}")


def init_admin_user():
    """
    초기 관리자 계정 자동 생성

    DB에 관리자 계정이 한 명도 없을 때만 ADMIN_EMAIL / ADMIN_PW 환경 변수로 생성합니다.
    이미 관리자 계정이 있으면 아무것도 하지 않습니다 (환경 변수 불필요).
    실행 이후 관리자 인증은 DB 기반으로만 동작합니다.
    DB 연결 실패 시에도 앱은 시작되도록 예외 처리합니다.
    """
    print("\n" + "=" * 60)
    print("관리자 계정 초기화 시작")
    print("=" * 60)

    try:
        # next(get_db())는 제너레이터 finally가 즉시 돌지 않아 세션/풀 관리가 애매함 → SessionLocal 직접 사용
        db = SessionLocal()
        try:
            # DB에 관리자가 이미 있으면 초기화 불필요
            any_admin = db.query(models.AdminUser).first()
            if any_admin:
                print(f"ℹ️  관리자 계정이 이미 존재합니다. 초기화를 건너뜁니다.")
                return

            # 관리자가 없는 경우 → ADMIN_EMAIL / ADMIN_PW 필요
            if not ADMIN_EMAIL or not ADMIN_PW:
                print("❌ DB에 관리자 계정이 없고 ADMIN_EMAIL / ADMIN_PW도 설정되지 않았습니다.")
                print("   .env 또는 Railway Variables에 ADMIN_EMAIL과 ADMIN_PW를 설정하세요.")
                print("=" * 60 + "\n")
                return

            # 새 관리자 생성 (is_super_admin=True 로 최고 관리자 지정)
            print(f"⚠️ 초기 관리자 계정 생성 중...")
            print(f"   이메일: {ADMIN_EMAIL}")
            hashed_pw = utils.get_password_hash(ADMIN_PW)
            new_admin = models.AdminUser(
                email=ADMIN_EMAIL,
                name="",
                hashed_password=hashed_pw,
                is_super_admin=True,
            )
            db.add(new_admin)
            db.commit()
            print("✅ 초기 관리자 생성 완료!")
            print(f"   이메일: {ADMIN_EMAIL}")
            print(f"   이름: (미설정 - 로그인 후 수정 가능)")
            print(f"   최고 관리자: True")

        except Exception as e:
            print(f"❌ 초기 관리자 생성 실패: {e}")
            import traceback
            traceback.print_exc()
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️ DB 연결 실패 (로그인/관리자 초기화 불가): {e}")
        print("💡 Railway Variables에서 DATABASE_URL을 확인하세요.")
        import traceback
        traceback.print_exc()

    print("=" * 60 + "\n")


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
app.include_router(polls.router)     # 투표 관리
app.include_router(schedule.router)  # 일정 관리
app.include_router(finance.router)   # 한국거래소 데이터
app.include_router(fsc.router)       # 금융위원회 데이터
app.include_router(api.router)       # REST API (외부 호출용)
if profile:
    app.include_router(profile.router)   # 프로필 설정 관리 (캐릭터, 주식 단어)
if stock_terms:
    app.include_router(stock_terms.router)  # 주식용어 관리
if master_quotes:
    app.include_router(master_quotes.router)  # 대가들의 한마디 관리
if market_voices:
    app.include_router(market_voices.router)  # 시장의 목소리
if investment_bank_news:
    app.include_router(investment_bank_news.router)  # 투자은행 뉴스 (GS/MS/JPM)
if target_price_news:
    app.include_router(target_price_news.router)  # 증권사 목표가 상향 뉴스
app.include_router(faq.router)          # FAQ 관리
app.include_router(terms.router)        # 약관 (개인정보처리방침, 이용약관)
app.include_router(popup.router)        # 팝업관리
app.include_router(broker.router)       # 증권사 설정
app.include_router(ad_settings.router)  # 광고설정 (어필리에이트 상품)
