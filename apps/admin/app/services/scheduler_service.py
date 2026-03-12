"""
FSC 데이터 자동 수집 스케줄러

매일 오후 1:30에 금융위원회 API에서 주식시세정보를 자동으로 수집합니다.
주말(토요일, 일요일)과 공휴일에는 실행하지 않습니다.
최근 3일치 데이터만 유지하고 오래된 데이터는 자동으로 삭제됩니다.
시가총액 상위 200개만 저장합니다.

참고:
- 금융위원회 주식시세 데이터는 당일(오늘) 데이터가 장 마감 직후 바로 생성되지 않을 수 있어,
  자동 수집 시에는 '직전 거래일'(-1, 월요일이면 -3 등) 기준일자를 조회합니다.
"""
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
import pytz
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import SessionLocal
from app.services.api_service import fsc_api_service, krx_api_service
from app.services.naver_finance_service import naver_finance_service
from app.services.exchange_rate_service import fetch_and_save_exchange_rates
from app.services.yahoo_index_service import (
    fetch_indices,
    upsert_indices_to_db,
    DEFAULT_US_INDICES,
    DEFAULT_KR_INDICES,
    DEFAULT_FOREIGN_INDICES,
    MORNING_SUMMARY_INDICES,
)
from app.services.investing_com_service import (
    fetch_kospi200_futures,
    upsert_kospi200_futures_to_db,
)
from app.models import FscStockPrice, FscRisingStock, KrxData


def is_weekend(date: datetime) -> bool:
    """
    주말인지 확인

    Args:
        date: 확인할 날짜

    Returns:
        bool: 토요일(5) 또는 일요일(6)이면 True
    """
    return date.weekday() >= 5


def is_korean_holiday(date: datetime) -> bool:
    """
    한국 공휴일인지 확인

    주요 고정 공휴일과 임시 공휴일을 체크합니다.

    Args:
        date: 확인할 날짜

    Returns:
        bool: 공휴일이면 True
    """
    # 공휴일 목록 (월, 일)
    fixed_holidays = [
        (1, 1),   # 신정
        (3, 1),   # 삼일절
        (5, 5),   # 어린이날
        (6, 6),   # 현충일
        (8, 15),  # 광복절
        (10, 3),  # 개천절
        (10, 9),  # 한글날
        (12, 25), # 크리스마스
    ]

    # 고정 공휴일 체크
    if (date.month, date.day) in fixed_holidays:
        return True

    # 설날, 추석 등 음력 공휴일은 Schedule 테이블에서 확인
    # (일정 관리에서 공휴일을 등록해서 관리)
    db = SessionLocal()
    try:
        from app.models import Schedule
        date_str = date.date()
        schedule = db.query(Schedule).filter(
            Schedule.date == date_str,
            Schedule.type == "api"
        ).first()

        if schedule and "공휴일" in schedule.subject:
            return True
    except Exception as e:
        print(f"⚠️ 공휴일 체크 오류: {e}")
    finally:
        db.close()

    return False


def should_skip_today() -> bool:
    """
    오늘 데이터 수집을 건너뛸지 결정

    주말이나 공휴일이면 True를 반환합니다.

    Returns:
        bool: 건너뛰어야 하면 True
    """
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)

    if is_weekend(now):
        print(f"⏭️ 주말이므로 데이터 수집을 건너뜁니다. ({now.strftime('%Y-%m-%d %A')})")
        return True

    if is_korean_holiday(now):
        print(f"⏭️ 공휴일이므로 데이터 수집을 건너뜁니다. ({now.strftime('%Y-%m-%d')})")
        return True

    return False


def get_previous_business_day(date: datetime) -> datetime:
    """
    직전 거래일(주말/공휴일 제외) 날짜를 반환합니다.

    - 화~금: 전일(-1)
    - 월요일: 금요일(-3)
    - 공휴일 다음 영업일: 공휴일/주말이 끝날 때까지 더 이전으로 이동
    """
    candidate = date - timedelta(days=1)
    while is_weekend(candidate) or is_korean_holiday(candidate):
        candidate = candidate - timedelta(days=1)
    return candidate


def cleanup_old_fsc_data(db: Session, keep_days: int = 3):
    """
    오래된 FSC 데이터 삭제 (최근 N일치만 유지)

    Args:
        db: 데이터베이스 세션
        keep_days: 유지할 일수 (기본값: 3일)
    """
    try:
        # DB에서 고유한 날짜 목록 조회 (최신순)
        dates = db.query(FscStockPrice.bas_dt)\
            .distinct()\
            .order_by(FscStockPrice.bas_dt.desc())\
            .all()

        date_list = [d[0] for d in dates]

        # 유지할 일수보다 많으면 오래된 날짜 삭제
        if len(date_list) > keep_days:
            dates_to_delete = date_list[keep_days:]

            for old_date in dates_to_delete:
                deleted_count = db.query(FscStockPrice)\
                    .filter(FscStockPrice.bas_dt == old_date)\
                    .delete()
                print(f"🗑️ FSC {old_date} 데이터 삭제 완료 ({deleted_count}건)")

            db.commit()
            print(f"✅ 오래된 FSC 데이터 정리 완료 (최근 {keep_days}일치만 유지)")
        else:
            print(f"ℹ️ 현재 FSC {len(date_list)}일치 데이터 보관 중 (정리 불필요)")

    except Exception as e:
        db.rollback()
        print(f"❌ FSC 데이터 정리 오류: {e}")


def cleanup_old_rising_data(db: Session, keep_days: int = 3):
    """
    오래된 상승종목 데이터 삭제 (최근 N일치만 유지)

    Args:
        db: 데이터베이스 세션
        keep_days: 유지할 일수 (기본값: 3일)
    """
    try:
        dates = db.query(FscRisingStock.bas_dt)\
            .distinct()\
            .order_by(FscRisingStock.bas_dt.desc())\
            .all()

        date_list = [d[0] for d in dates]

        if len(date_list) > keep_days:
            dates_to_delete = date_list[keep_days:]

            for old_date in dates_to_delete:
                deleted_count = db.query(FscRisingStock)\
                    .filter(FscRisingStock.bas_dt == old_date)\
                    .delete()
                print(f"🗑️ 상승종목 {old_date} 데이터 삭제 완료 ({deleted_count}건)")

            db.commit()
            print(f"✅ 오래된 상승종목 데이터 정리 완료 (최근 {keep_days}일치만 유지)")
        else:
            print(f"ℹ️ 현재 상승종목 {len(date_list)}일치 데이터 보관 중 (정리 불필요)")

    except Exception as e:
        db.rollback()
        print(f"❌ 상승종목 데이터 정리 오류: {e}")


def cleanup_old_krx_data(db: Session, keep_days: int = 3):
    """
    오래된 KRX 데이터 삭제 (최근 N일치만 유지)

    Args:
        db: 데이터베이스 세션
        keep_days: 유지할 일수 (기본값: 3일)
    """
    try:
        # 각 데이터 타입별로 날짜 목록 조회
        for data_type in ['kospi', 'kosdaq']:
            dates = db.query(KrxData.bas_dd)\
                .filter(KrxData.data_type == data_type)\
                .distinct()\
                .order_by(KrxData.bas_dd.desc())\
                .all()

            date_list = [d[0] for d in dates]

            # 유지할 일수보다 많으면 오래된 날짜 삭제
            if len(date_list) > keep_days:
                dates_to_delete = date_list[keep_days:]

                for old_date in dates_to_delete:
                    deleted_count = db.query(KrxData)\
                        .filter(
                            KrxData.data_type == data_type,
                            KrxData.bas_dd == old_date
                        )\
                        .delete()
                    print(f"🗑️ KRX {data_type} {old_date} 데이터 삭제 완료 ({deleted_count}건)")

        db.commit()
        print(f"✅ 오래된 KRX 데이터 정리 완료 (최근 {keep_days}일치만 유지)")

    except Exception as e:
        db.rollback()
        print(f"❌ KRX 데이터 정리 오류: {e}")


async def collect_fsc_data():
    """
    FSC 주식시세정보 자동 수집 작업

    매일 오후 1:30에 실행되며, 주말과 공휴일은 건너뜁니다.
    최신 데이터를 자동으로 찾아 수집합니다 (시가총액 상위 200개).
    """
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)
    print(f"\n{'='*60}")
    print(f"📊 FSC 데이터 자동 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    # 주말/공휴일 체크
    if should_skip_today():
        print(f"{'='*60}\n")
        return

    db = SessionLocal()
    try:
        # 최신 데이터 수집 (bas_dt=None으로 호출하면 API가 자동으로 최신 데이터를 찾음)
        print("🔄 금융위원회 API 호출 중... (최신 데이터 확인)")
        data, actual_date = await fsc_api_service.fetch_stock_price_info(
            page_no=1,
            num_of_rows=200,
            bas_dt=None,  # None으로 호출하면 최신 데이터 자동 조회
            db=db
        )

        if data and len(data) > 0 and actual_date:
            print(f"✅ 최신 데이터 수집 완료: {actual_date} ({len(data)}건)")

            # 3일치 데이터만 유지
            cleanup_old_fsc_data(db, keep_days=3)

            print(f"{'='*60}")
            print(f"✅ FSC 데이터 자동 수집 완료")
            print(f"{'='*60}\n")
        else:
            print(f"⚠️ 수집된 데이터가 없습니다.")
            print(f"{'='*60}\n")

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 데이터 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        print(f"{'='*60}\n")
    finally:
        db.close()


async def collect_rising_stocks_data():
    """
    FSC 상승종목 자동 수집 작업

    매일 오후 1:30에 실행되며, 주말과 공휴일은 건너뜁니다.
    최신 데이터를 자동으로 찾아 상승종목을 수집합니다.
    """
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)
    print(f"\n{'='*60}")
    print(f"📈 FSC 상승종목 자동 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    # 주말/공휴일 체크
    if should_skip_today():
        print(f"{'='*60}\n")
        return

    db = SessionLocal()
    try:
        # 최신 데이터 수집 (bas_dt=None으로 호출하면 API가 자동으로 최신 데이터를 찾음)
        print("🔄 금융위원회 API 호출 중... (최신 상승종목 확인 - 10% 이상 상승 종목만)")
        data, actual_date = await fsc_api_service.fetch_rising_stocks(
            bas_dt=None,  # None으로 호출하면 최신 데이터 자동 조회
            db=db,
            min_flt_rt=10.0,  # 10% 이상 상승 종목만
            limit=1000
        )

        if data and len(data) > 0 and actual_date:
            print(f"✅ 최신 상승종목 수집 완료: {actual_date} ({len(data)}건)")

            # 3일치 상승종목 데이터만 유지
            cleanup_old_rising_data(db, keep_days=3)

            print(f"{'='*60}")
            print(f"✅ FSC 상승종목 자동 수집 완료")
            print(f"{'='*60}\n")
        else:
            print(f"⚠️ 수집된 상승종목 데이터가 없습니다.")
            print(f"{'='*60}\n")

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 상승종목 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        print(f"{'='*60}\n")
    finally:
        db.close()


class FscScheduler:
    """
    FSC 데이터 수집 스케줄러

    매일 오후 1:30에 자동으로 데이터를 수집합니다.
    """

    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone('Asia/Seoul')

    def start(self):
        """스케줄러 시작"""
        if self.scheduler is not None:
            print("⚠️ 스케줄러가 이미 실행 중입니다.")
            return

        self.scheduler = AsyncIOScheduler(timezone=self.kst)

        # 매일 오후 2:30에 실행 (시가총액 상위)
        self.scheduler.add_job(
            collect_fsc_data,
            trigger=CronTrigger(hour=14, minute=30, timezone=self.kst),
            id='fsc_data_collection',
            name='FSC 주식시세정보 자동 수집',
            replace_existing=True
        )

        # 매일 오후 2:35에 실행 (상승종목) - 시가총액 수집 완료 후 실행
        self.scheduler.add_job(
            collect_rising_stocks_data,
            trigger=CronTrigger(hour=14, minute=35, timezone=self.kst),
            id='fsc_rising_stocks_collection',
            name='FSC 상승종목 자동 수집',
            replace_existing=True
        )

        self.scheduler.start()
        print("✅ FSC 데이터 수집 스케줄러 시작 (매일 14:30)")
        print(f"   - 시가총액 상위: 14:30")
        print(f"   - 상승종목: 14:35")
        print(f"   - 주말 및 공휴일 제외")
        print(f"   - 최근 3일치 데이터만 유지\n")

    def shutdown(self):
        """스케줄러 종료"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ FSC 데이터 수집 스케줄러 종료")


# 전역 스케줄러 인스턴스
fsc_scheduler = FscScheduler()


# =========================================================
# KRX 데이터 자동 수집 스케줄러
# =========================================================

async def collect_krx_data():
    """
    KRX 지수 데이터 자동 수집 작업 (코스피, 코스닥)
    
    매일 오후 1:30에 실행되며, 주말과 공휴일은 건너뜁니다.
    데이터 수집 후 최근 3일치만 유지하고 나머지는 삭제합니다.
    """
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)
    print(f"\n{'='*60}")
    print(f"📊 KRX 데이터 자동 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    # 주말/공휴일 체크
    if should_skip_today():
        print(f"{'='*60}\n")
        return

    db = SessionLocal()
    try:
        # 코스피 데이터 수집
        print("🔄 코스피 지수 데이터 수집 중...")
        kospi_data = await krx_api_service.fetch_kospi_index(bas_dd=None, db=db)
        
        if kospi_data and len(kospi_data) > 0:
            print(f"✅ 코스피 데이터 수집 완료: {len(kospi_data)}건")
        else:
            print(f"⚠️ 코스피 데이터 수집 실패")

        # 코스닥 데이터 수집
        print("🔄 코스닥 지수 데이터 수집 중...")
        kosdaq_data = await krx_api_service.fetch_kosdaq_index(bas_dd=None, db=db)
        
        if kosdaq_data and len(kosdaq_data) > 0:
            print(f"✅ 코스닥 데이터 수집 완료: {len(kosdaq_data)}건")
        else:
            print(f"⚠️ 코스닥 데이터 수집 실패")

        if (kospi_data and len(kospi_data) > 0) or (kosdaq_data and len(kosdaq_data) > 0):
            # 3일치 데이터만 유지
            cleanup_old_krx_data(db, keep_days=3)

            print(f"{'='*60}")
            print(f"✅ KRX 데이터 자동 수집 완료")
            print(f"{'='*60}\n")
        else:
            print(f"⚠️ 수집된 데이터가 없습니다.")
            print(f"{'='*60}\n")

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ KRX 데이터 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        print(f"{'='*60}\n")
    finally:
        db.close()


class KrxScheduler:
    """
    KRX 데이터 수집 스케줄러
    
    매일 오후 1:30에 자동으로 데이터를 수집합니다.
    """

    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone('Asia/Seoul')

    def start(self):
        """스케줄러 시작"""
        if self.scheduler is not None:
            print("⚠️ KRX 스케줄러가 이미 실행 중입니다.")
            return

        self.scheduler = AsyncIOScheduler(timezone=self.kst)

        # 매일 오후 2:30에 실행
        self.scheduler.add_job(
            collect_krx_data,
            trigger=CronTrigger(hour=14, minute=30, timezone=self.kst),
            id='krx_data_collection',
            name='KRX 지수 데이터 자동 수집',
            replace_existing=True
        )

        self.scheduler.start()
        print("✅ KRX 데이터 수집 스케줄러 시작 (매일 14:30)")
        print(f"   - 주말 및 공휴일 제외")
        print(f"   - 최근 3일치 데이터만 유지\n")

    def shutdown(self):
        """스케줄러 종료"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ KRX 데이터 수집 스케줄러 종료")


# 전역 스케줄러 인스턴스
krx_scheduler = KrxScheduler()


# =========================================================
# 네이버 증권 랭킹 데이터 자동 수집 스케줄러
# =========================================================

async def collect_naver_ranking_data():
    """
    네이버 증권 랭킹 데이터 자동 수집 작업
    
    거래량 상위, 거래대금 상위, 검색 상위 데이터를 수집합니다.
    하루에 3번(11시, 16시, 21시) 실행됩니다.
    """
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)
    current_hour = now.hour
    
    # 수집 시간대 결정
    if current_hour == 11:
        collected_time = '11:00'
    elif current_hour == 16:
        collected_time = '16:00'
    elif current_hour == 21:
        collected_time = '21:00'
    else:
        collected_time = f"{current_hour:02d}:00"
    
    print(f"\n{'='*60}")
    print(f"📊 네이버 증권 랭킹 데이터 자동 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   수집 시간대: {collected_time}")
    print(f"{'='*60}")
    
    # 주말/공휴일 체크
    if should_skip_today():
        print(f"{'='*60}\n")
        return
    
    db = SessionLocal()
    try:
        # 1. 거래량 상위 수집 (코스피, 코스닥, 전체)
        print("🔄 거래량 상위 데이터 수집 중...")
        for market_type in ['kospi', 'kosdaq', 'all']:
            try:
                volume_data = await naver_finance_service.fetch_volume_ranking(
                    market_type=market_type,
                    limit=50
                )
                if volume_data:
                    naver_finance_service.save_ranking_to_db(
                        db=db,
                        ranking_type='volume',
                        market_type=market_type,
                        data=volume_data,
                        collected_time=collected_time
                    )
            except Exception as e:
                print(f"⚠️ 거래량 상위 ({market_type}) 수집 오류: {e}")
        
        # 2. 거래대금 상위 수집 (코스피, 코스닥, 전체)
        print("🔄 거래대금 상위 데이터 수집 중...")
        for market_type in ['kospi', 'kosdaq', 'all']:
            try:
                amount_data = await naver_finance_service.fetch_amount_ranking(
                    market_type=market_type,
                    limit=50
                )
                if amount_data:
                    naver_finance_service.save_ranking_to_db(
                        db=db,
                        ranking_type='amount',
                        market_type=market_type,
                        data=amount_data,
                        collected_time=collected_time
                    )
            except Exception as e:
                print(f"⚠️ 거래대금 상위 ({market_type}) 수집 오류: {e}")
        
        # 3. 검색 상위 수집
        print("🔄 검색 상위 데이터 수집 중...")
        try:
            search_data = await naver_finance_service.fetch_search_ranking(limit=50)
            if search_data:
                naver_finance_service.save_ranking_to_db(
                    db=db,
                    ranking_type='search',
                    market_type='all',
                    data=search_data,
                    collected_time=collected_time
                )
        except Exception as e:
            print(f"⚠️ 검색 상위 수집 오류: {e}")
        
        print(f"{'='*60}")
        print(f"✅ 네이버 증권 랭킹 데이터 자동 수집 완료")
        print(f"{'='*60}\n")
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ 네이버 증권 랭킹 데이터 수집 오류: {e}")
        print(f"❌ 상세 오류:\n{error_detail}")
        print(f"{'='*60}\n")
    finally:
        db.close()


class NaverRankingScheduler:
    """
    네이버 증권 랭킹 데이터 수집 스케줄러
    
    하루에 3번(11시, 16시, 21시) 자동으로 데이터를 수집합니다.
    """
    
    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone('Asia/Seoul')
    
    def start(self):
        """스케줄러 시작"""
        if self.scheduler is not None:
            print("⚠️ 네이버 랭킹 스케줄러가 이미 실행 중입니다.")
            return
        
        self.scheduler = AsyncIOScheduler(timezone=self.kst)
        
        # 06:30, 11시, 16시, 21시 (한국시간)
        self.scheduler.add_job(
            collect_naver_ranking_data,
            trigger=CronTrigger(hour=6, minute=30, timezone=self.kst),
            id='naver_ranking_0630',
            name='네이버 증권 랭킹 데이터 수집 (06:30)',
            replace_existing=True
        )
        self.scheduler.add_job(
            collect_naver_ranking_data,
            trigger=CronTrigger(hour=11, minute=0, timezone=self.kst),
            id='naver_ranking_11',
            name='네이버 증권 랭킹 데이터 수집 (11시)',
            replace_existing=True
        )
        self.scheduler.add_job(
            collect_naver_ranking_data,
            trigger=CronTrigger(hour=16, minute=0, timezone=self.kst),
            id='naver_ranking_16',
            name='네이버 증권 랭킹 데이터 수집 (16시)',
            replace_existing=True
        )
        self.scheduler.add_job(
            collect_naver_ranking_data,
            trigger=CronTrigger(hour=21, minute=0, timezone=self.kst),
            id='naver_ranking_21',
            name='네이버 증권 랭킹 데이터 수집 (21시)',
            replace_existing=True
        )
        
        self.scheduler.start()
        print("✅ 네이버 증권 랭킹 데이터 수집 스케줄러 시작 (06:30, 11시, 16시, 21시)")
        print(f"   - 주말 및 공휴일 제외")
        print(f"   - 거래량 상위, 거래대금 상위, 검색 상위 수집\n")
    
    def shutdown(self):
        """스케줄러 종료"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ 네이버 증권 랭킹 데이터 수집 스케줄러 종료")


# =========================================================
# Yahoo Finance 지수 수집 스케줄러
# =========================================================

async def collect_yahoo_us_indices():
    """
    Yahoo Finance 미국증시 지수 수집/저장
    - 06:20 / 00:00 / 02:00 / 04:00 (KST)
    - 수집 시점의 값으로 일별 최종값 upsert + 7일 유지
    """
    now = datetime.now(pytz.timezone("Asia/Seoul"))
    print(f"\n🌐 Yahoo(US) 지수 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    try:
        items = await fetch_indices(DEFAULT_US_INDICES)
        if items:
            upsert_indices_to_db(db, items, collected_at=now, keep_days=7)
            print(f"✅ Yahoo(US) 지수 저장 완료: {len(items)}개")
        else:
            print("⚠️ Yahoo(US) 지수 수집 결과 없음")
    except Exception as e:
        print(f"❌ Yahoo(US) 지수 수집 오류: {e}")
    finally:
        db.close()


async def collect_yahoo_foreign_indices():
    """
    Yahoo Finance 해외지수 수집/저장 (메인 페이지용)
    - 00:00, 05:00, 06:30 (KST)
    - YahooIndexSnapshot에 group='foreign'으로 저장
    """
    now = datetime.now(pytz.timezone("Asia/Seoul"))
    print(f"\n🌐 Yahoo(해외) 지수 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    try:
        items = await fetch_indices(DEFAULT_FOREIGN_INDICES)
        if items:
            upsert_indices_to_db(db, items, collected_at=now, keep_days=7)
            print(f"✅ Yahoo(해외) 지수 저장 완료: {len(items)}개")
        else:
            print("⚠️ Yahoo(해외) 지수 수집 결과 없음")
    except Exception as e:
        print(f"❌ Yahoo(해외) 지수 수집 오류: {e}")
    finally:
        db.close()


async def collect_market_morning_summary():
    """
    아침 시장 요약 수집 (06:35 KST)
    - 뉴욕증시 마감시황 (나스닥/S&P500/다우)
    - 나스닥 선물, 코스피 200, 코스피200 야간선물 (Investing.com)
    - 환율은 exchange_rate_scheduler가 30분마다 수집하므로 별도 수집 없음
    - 수집 완료 후 Gemini AI 요약 생성·저장
    - 주말(토·일) 및 공휴일은 건너뜀
    """
    if should_skip_today():
        print("ℹ️ 주말/공휴일: 아침 시장 요약 수집 건너뜀")
        return

    now = datetime.now(pytz.timezone("Asia/Seoul"))
    print(f"\n📊 아침 시장 요약 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    try:
        items = await fetch_indices(MORNING_SUMMARY_INDICES)
        if items:
            upsert_indices_to_db(db, items, collected_at=now, keep_days=7)
            ok_count = sum(1 for i in items if i.get("ok") is True)
            print(f"✅ 아침 시장 요약 저장 완료: {ok_count}개")
        else:
            print("⚠️ 아침 시장 요약 수집 결과 없음")

        # 코스피200 야간선물 (Investing.com)
        try:
            kospi200_fut = await fetch_kospi200_futures()
            if kospi200_fut and kospi200_fut.get("ok"):
                upsert_kospi200_futures_to_db(db, kospi200_fut, collected_at=now)
                print(f"✅ 코스피200 야간선물 저장 완료: {kospi200_fut.get('price')}")
            else:
                print(f"⚠️ 코스피200 야간선물 수집 실패: {kospi200_fut.get('error', 'unknown')}")
        except Exception as e:
            print(f"⚠️ 코스피200 야간선물 수집 오류: {e}")

        # Gemini AI 요약 생성
        try:
            from app.engine import models as _models
            from app.services.market_morning_gemini_service import generate_and_save_ai_summary

            today = now.date()
            _MORNING_ORDER = {
                "^IXIC": 0, "^GSPC": 1, "^DJI": 2, "^SOX": 3, "NQ=F": 4,
                "^KS200": 5, "INV:8893": 6, "^MSKR": 7, "EWY": 8, "^KS11": 9, "^KQ11": 10,
            }
            rows = db.query(_models.YahooIndexDaily).filter(
                _models.YahooIndexDaily.date == today,
                _models.YahooIndexDaily.group == "morning",
            ).all()
            rows = sorted(rows, key=lambda r: _MORNING_ORDER.get(r.symbol, 99))
            indices_for_gemini = [
                {
                    "name": r.name,
                    "symbol": r.symbol,
                    "price": round(r.price or 0, 2),
                    "change": round(r.change or 0, 2),
                    "changePercent": round(r.change_percent or 0, 2),
                }
                for r in rows if r.price is not None
            ]

            latest_ex = db.query(func.max(_models.ExchangeRateSnapshot.collected_at)).scalar()
            exchange_rates_for_gemini = []
            if latest_ex:
                currency_names = {"USD": "USD/KRW", "JPY": "JPY/KRW (100엔)", "EUR": "EUR/KRW"}
                ex_rows = db.query(_models.ExchangeRateSnapshot).filter(
                    _models.ExchangeRateSnapshot.collected_at == latest_ex,
                ).all()
                exchange_rates_for_gemini = [
                    {
                        "currency": currency_names.get(r.currency, r.currency),
                        "rate": round(r.rate, 2),
                        "change": round(r.change_val, 2),
                    }
                    for r in ex_rows
                ]

            if indices_for_gemini:
                ok = generate_and_save_ai_summary(
                    db=db,
                    indices=indices_for_gemini,
                    exchange_rates=exchange_rates_for_gemini,
                    target_date=today,
                )
                if ok:
                    try:
                        from app.services.fcm_service import send_push_to_all
                        await send_push_to_all(
                            db,
                            title="📊 오늘 아침 시황이 도착했습니다",
                            body="뉴욕 마감·한국 증시 주목 포인트를 확인하세요",
                            data={"link_url": "/", "type": "morning_summary"},
                        )
                        print("[morning-gemini] FCM 모닝 알림 발송 완료")
                    except Exception as fcm_err:
                        print(f"[morning-gemini] FCM 발송 오류: {fcm_err}")
            else:
                print("[morning-gemini] 지수 데이터 없어 AI 요약 건너뜀")
        except Exception as e:
            print(f"⚠️ Gemini AI 요약 오류: {e}")

    except Exception as e:
        print(f"❌ 아침 시장 요약 수집 오류: {e}")
    finally:
        db.close()


async def collect_market_closing_summary():
    """
    장마감 시황 생성 및 board/B001 게시 (15:40 KST)
    - 15:30 수집된 KR지수·수급동향·뉴스 데이터를 Gemini로 요약
    - 주말/공휴일은 건너뜀
    """
    if should_skip_today():
        print("ℹ️ 주말/공휴일: 장마감 시황 생성 건너뜀")
        return

    now = datetime.now(pytz.timezone("Asia/Seoul"))
    print(f"\n📰 장마감 시황 생성 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    try:
        from app.services.market_closing_gemini_service import generate_and_post_closing_summary
        ok = generate_and_post_closing_summary(db, now.date())
        if ok:
            print("✅ 장마감 시황 게시 완료")
            try:
                from app.services.fcm_service import send_push_to_all
                await send_push_to_all(
                    db,
                    title="📊 오늘 장마감 시황이 도착했습니다",
                    body="오늘 코스피·코스닥 시황과 내일 주목할 포인트를 확인하세요",
                    data={"link_url": "/board/B001", "type": "closing_summary"},
                )
                print("[closing-gemini] FCM 마감시황 알림 발송 완료")
            except Exception as fcm_err:
                print(f"[closing-gemini] FCM 발송 오류: {fcm_err}")
        else:
            print("⚠️ 장마감 시황 생성 실패 (데이터 부족 또는 Gemini 오류)")
    except Exception as e:
        import traceback
        print(f"❌ 장마감 시황 생성 오류: {e}")
        print(traceback.format_exc())
    finally:
        db.close()


async def collect_yahoo_kr_indices():
    """
    Yahoo Finance 국내지수(코스피/코스닥) 수집/저장
    - 09:20 / 11:30 / 14:00 / 15:30 (KST)
    - 기존 데이터를 덮어쓰되, 날짜별 마지막 값 유지 (date+symbol upsert)
    - 최대 7일만 보관
    - 주말/공휴일은 건너뜀
    """
    now = datetime.now(pytz.timezone("Asia/Seoul"))
    print(f"\n🇰🇷 Yahoo(KR) 지수 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    if should_skip_today():
        print("ℹ️ 주말/공휴일: Yahoo(KR) 지수 수집 건너뜀")
        return

    db = SessionLocal()
    try:
        items = await fetch_indices(DEFAULT_KR_INDICES)
        if items:
            upsert_indices_to_db(db, items, collected_at=now, keep_days=7)
            print(f"✅ Yahoo(KR) 지수 저장 완료: {len(items)}개")
        else:
            print("⚠️ Yahoo(KR) 지수 수집 결과 없음")
    except Exception as e:
        print(f"❌ Yahoo(KR) 지수 수집 오류: {e}")
    finally:
        db.close()


class YahooIndexScheduler:
    """
    Yahoo Finance 지수 수집 스케줄러
    """
    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone('Asia/Seoul')

    def start(self):
        if self.scheduler is not None:
            print("⚠️ Yahoo 지수 스케줄러가 이미 실행 중입니다.")
            return

        self.scheduler = AsyncIOScheduler(timezone=self.kst)

        # 해외지수(메인용): 00:00, 05:00, 06:30 (KST)
        self.scheduler.add_job(
            collect_yahoo_foreign_indices,
            CronTrigger(hour=0, minute=0, timezone=self.kst),
            id="yahoo_foreign_0000",
            name="Yahoo 해외지수 (00:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_foreign_indices,
            CronTrigger(hour=5, minute=0, timezone=self.kst),
            id="yahoo_foreign_0500",
            name="Yahoo 해외지수 (05:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_foreign_indices,
            CronTrigger(hour=6, minute=30, timezone=self.kst),
            id="yahoo_foreign_0630",
            name="Yahoo 해외지수 (06:30)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        # 아침 시장 요약 (뉴욕 마감, 나스닥 선물, 코스피200) - 06:35 KST
        self.scheduler.add_job(
            collect_market_morning_summary,
            CronTrigger(hour=6, minute=35, timezone=self.kst),
            id="market_morning_summary",
            name="아침 시장 요약 (06:35)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )

        # US: 06:20, 00:00, 02:00, 04:00 (KST)
        self.scheduler.add_job(
            collect_yahoo_us_indices,
            CronTrigger(hour=6, minute=20, timezone=self.kst),
            id="yahoo_us_0620",
            name="Yahoo US Indices (06:20)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_us_indices,
            CronTrigger(hour=0, minute=0, timezone=self.kst),
            id="yahoo_us_0000",
            name="Yahoo US Indices (00:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_us_indices,
            CronTrigger(hour=2, minute=0, timezone=self.kst),
            id="yahoo_us_0200",
            name="Yahoo US Indices (02:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_us_indices,
            CronTrigger(hour=4, minute=0, timezone=self.kst),
            id="yahoo_us_0400",
            name="Yahoo US Indices (04:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )

        # KR: 09:20, 11:30, 14:00, 15:30 (KST)
        self.scheduler.add_job(
            collect_yahoo_kr_indices,
            CronTrigger(hour=9, minute=20, timezone=self.kst),
            id="yahoo_kr_0920",
            name="Yahoo KR Indices (09:20)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_kr_indices,
            CronTrigger(hour=11, minute=30, timezone=self.kst),
            id="yahoo_kr_1130",
            name="Yahoo KR Indices (11:30)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_kr_indices,
            CronTrigger(hour=14, minute=0, timezone=self.kst),
            id="yahoo_kr_1400",
            name="Yahoo KR Indices (14:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_kr_indices,
            CronTrigger(hour=15, minute=30, timezone=self.kst),
            id="yahoo_kr_1530",
            name="Yahoo KR Indices (15:30)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        # 장마감 시황 생성: 15:40 (15:30 KR지수 수집 완료 후)
        self.scheduler.add_job(
            collect_market_closing_summary,
            CronTrigger(hour=15, minute=40, timezone=self.kst),
            id="market_closing_summary",
            name="장마감 시황 생성 (15:40)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )

        self.scheduler.start()
        print("✅ Yahoo 지수 수집 스케줄러 시작")
        print("   - 해외(메인): 00:00 / 05:00 / 06:30 (KST)")
        print("   - US: 06:20 / 00:00 / 02:00 / 04:00 (KST)")
        print("   - KR: 09:20 / 11:30 / 14:00 / 15:30 (KST)")
        print("   - 장마감 시황: 15:40 (KST, 주말/공휴일 제외)")
        print("   - 최근 7일치만 유지\n")

    def shutdown(self):
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ Yahoo 지수 수집 스케줄러 종료")


yahoo_index_scheduler = YahooIndexScheduler()


# =========================================================
# 환율 수집 스케줄러 (30분마다)
# =========================================================

async def collect_exchange_rates():
    """30분마다 Yahoo Finance에서 환율 수집 후 DB 저장"""
    now = datetime.now(pytz.timezone("Asia/Seoul"))
    print(f"\n💱 환율 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    db = SessionLocal()
    try:
        ok = await fetch_and_save_exchange_rates(db)
        if ok:
            print("✅ 환율 저장 완료")
        else:
            print("⚠️ 환율 수집 결과 없음")
    except Exception as e:
        print(f"❌ 환율 수집 오류: {e}")
    finally:
        db.close()


class ExchangeRateScheduler:
    """환율 30분마다 수집 스케줄러"""
    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone("Asia/Seoul")

    def start(self):
        if self.scheduler is not None:
            print("⚠️ 환율 스케줄러가 이미 실행 중입니다.")
            return
        self.scheduler = AsyncIOScheduler(timezone=self.kst)
        self.scheduler.add_job(
            collect_exchange_rates,
            CronTrigger(minute="0,30", timezone=self.kst),
            id="exchange_rate",
            name="환율 수집 (30분마다)",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.start()
        print("✅ 환율 수집 스케줄러 시작 (30분마다)")

    def shutdown(self):
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ 환율 수집 스케줄러 종료")


exchange_rate_scheduler = ExchangeRateScheduler()


# =========================================================
# 네이버 수급 동향 수집 스케줄러
# 08:30 ~ 20:30, 30분 간격, 월~금, 공휴일 제외
# =========================================================

async def collect_naver_supply_data():
    """네이버 수급 동향 전체 수집"""
    from app.services.naver_supply_service import collect_all_supply_data
    kst = pytz.timezone("Asia/Seoul")
    now = datetime.now(kst)
    print(f"\n{'='*60}")
    print(f"📊 네이버 수급 동향 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    if should_skip_today():
        print("⏭️ 주말/공휴일 - 수급 동향 수집 건너뜀")
        return

    db = SessionLocal()
    try:
        count = await collect_all_supply_data(db)
        print(f"✅ 수급 동향 수집 완료: {count}건")
    except Exception as e:
        import traceback
        print(f"❌ 수급 동향 수집 오류: {e}")
        print(traceback.format_exc())
    finally:
        db.close()
    print(f"{'='*60}\n")


class NaverSupplyScheduler:
    """
    네이버 수급 동향 데이터 수집 스케줄러
    08:30 ~ 20:30, 1시간 간격, 월~금, 공휴일 제외
    실행 시각: 08:30, 09:30, 10:30, 11:30, 12:30,
              13:30, 14:30, 15:30, 16:30, 17:30,
              18:30, 19:30, 20:30
    """
    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone("Asia/Seoul")

    def start(self):
        if self.scheduler is not None:
            print("⚠️ 수급 동향 스케줄러가 이미 실행 중입니다.")
            return

        self.scheduler = AsyncIOScheduler(timezone=self.kst)

        # 매 시 30분, 08~20시 → 08:30, 09:30, ..., 20:30
        self.scheduler.add_job(
            collect_naver_supply_data,
            trigger=CronTrigger(hour="8-20", minute=30, timezone=self.kst),
            id="naver_supply_hourly",
            name="수급 동향 수집 (08:30~20:30, 1시간 간격)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )

        self.scheduler.start()
        print("✅ 네이버 수급 동향 스케줄러 시작 (08:30~20:30, 1시간 간격, 월~금)")

    def shutdown(self):
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ 네이버 수급 동향 스케줄러 종료")


naver_supply_scheduler = NaverSupplyScheduler()

# 전역 스케줄러 인스턴스
naver_ranking_scheduler = NaverRankingScheduler()


# =========================================================
# 네이버 뉴스 주가 영향 뉴스 수집 스케줄러
# =========================================================

async def collect_naver_stock_news():
    """
    네이버 뉴스 API로 주가 직접 영향 뉴스 수집
    평일(월~금) 08:00, 12:00, 19:00에 실행
    수주, 실적발표, 배당, 연구개발, 기술이전, 유상증자 등 키워드 기반 필터링
    최근 2일치 뉴스만 유지
    """
    from app.services.naver_news_service import naver_news_service

    kst = pytz.timezone("Asia/Seoul")
    now = datetime.now(kst)
    print(f"\n{'='*60}")
    print(f"네이버 주가 영향 뉴스 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    if should_skip_today():
        print(f"{'='*60}\n")
        return

    db = SessionLocal()
    try:
        news_list = await naver_news_service.fetch_stock_impact_news()
        if news_list:
            saved = naver_news_service.save_news_to_db(db, news_list)
            print(f"신규 뉴스 저장: {saved}건")

        naver_news_service.cleanup_old_news(db)

        print(f"{'='*60}")
        print(f"네이버 주가 영향 뉴스 수집 완료")
        print(f"{'='*60}\n")
    except Exception as e:
        import traceback
        print(f"네이버 주가 영향 뉴스 수집 오류: {e}")
        print(traceback.format_exc())
        print(f"{'='*60}\n")
    finally:
        db.close()


class NaverNewsScheduler:
    """
    네이버 주가 영향 뉴스 수집 스케줄러
    평일(월~금) 08:00, 12:00, 19:00에 수집
    """

    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone("Asia/Seoul")

    def start(self):
        if self.scheduler is not None:
            print("네이버 뉴스 스케줄러가 이미 실행 중입니다.")
            return

        self.scheduler = AsyncIOScheduler(timezone=self.kst)
        self.scheduler.add_job(
            collect_naver_stock_news,
            trigger=CronTrigger(day_of_week="mon-fri", hour="8,12,19", minute=0, timezone=self.kst),
            id="naver_stock_news_collection",
            name="주가 영향 뉴스 수집 (08:00/12:00/19:00, 월~금)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.start()
        print("네이버 주가 영향 뉴스 스케줄러 시작 (08:00/12:00/19:00, 월~금)")

    def shutdown(self):
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("네이버 주가 영향 뉴스 스케줄러 종료")


naver_news_scheduler = NaverNewsScheduler()


# =========================================================
# 시장의 목소리 수집 스케줄러
# =========================================================

def cleanup_old_market_voices(db: Session, keep_days: int = 2):
    """2일 이상 지난 market_voices 레코드 삭제 (pending/approved 모두)"""
    try:
        from app.models import MarketVoice
        cutoff = datetime.utcnow() - timedelta(days=keep_days)
        deleted = db.query(MarketVoice).filter(MarketVoice.created_at < cutoff).delete()
        db.commit()
        if deleted:
            print(f"🗑️ 시장의 목소리 오래된 항목 삭제: {deleted}건 (2일 초과)")
    except Exception as e:
        db.rollback()
        print(f"❌ 시장의 목소리 정리 오류: {e}")


async def collect_market_voices():
    """
    person_master 인물별 뉴스 수집 → Gemini 요약 → market_voices pending 저장
    평일(월~금) 08:30, 12:30, 19:30에 실행 (뉴스 수집 직후)
    수집 전에 2일 초과 항목 자동 정리
    """
    from app.services.market_voice_service import fetch_and_summarize_news

    kst = pytz.timezone("Asia/Seoul")
    now = datetime.now(kst)
    print(f"\n{'='*60}")
    print(f"시장의 목소리 수집 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    if should_skip_today():
        print(f"{'='*60}\n")
        return

    db = SessionLocal()
    try:
        # 2일 초과 항목 정리
        cleanup_old_market_voices(db, keep_days=2)

        result = await fetch_and_summarize_news(db)
        print(f"시장의 목소리 수집 완료: {result.get('saved', 0)}건 신규 저장 (pending)")
        print(f"{'='*60}\n")
    except Exception as e:
        import traceback
        print(f"시장의 목소리 수집 오류: {e}")
        print(traceback.format_exc())
        print(f"{'='*60}\n")
    finally:
        db.close()


class MarketVoiceScheduler:
    """시장의 목소리 수집 스케줄러 (평일 08:30, 12:30, 19:30)"""

    def __init__(self):
        self.scheduler = None
        self.kst = pytz.timezone("Asia/Seoul")

    def start(self):
        if self.scheduler is not None:
            return
        self.scheduler = AsyncIOScheduler(timezone=self.kst)
        self.scheduler.add_job(
            collect_market_voices,
            trigger=CronTrigger(day_of_week="mon-fri", hour="8,12,19", minute=30, timezone=self.kst),
            id="market_voice_collection",
            name="시장의 목소리 수집 (08:30/12:30/19:30, 월~금)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.start()
        print("시장의 목소리 스케줄러 시작 (08:30/12:30/19:30, 월~금)")

    def shutdown(self):
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None


market_voice_scheduler = MarketVoiceScheduler()
