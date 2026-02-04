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
from app.services.yahoo_index_service import (
    fetch_indices,
    upsert_indices_to_db,
    DEFAULT_US_INDICES,
    DEFAULT_KR_INDICES,
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

        # 매일 오후 1:30에 실행
        self.scheduler.add_job(
            collect_fsc_data,
            trigger=CronTrigger(hour=13, minute=30, timezone=self.kst),
            id='fsc_data_collection',
            name='FSC 주식시세정보 자동 수집',
            replace_existing=True
        )

        self.scheduler.start()
        print("✅ FSC 데이터 수집 스케줄러 시작 (매일 13:30)")
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

        # 매일 오후 1:30에 실행
        self.scheduler.add_job(
            collect_krx_data,
            trigger=CronTrigger(hour=13, minute=30, timezone=self.kst),
            id='krx_data_collection',
            name='KRX 지수 데이터 자동 수집',
            replace_existing=True
        )

        self.scheduler.start()
        print("✅ KRX 데이터 수집 스케줄러 시작 (매일 13:30)")
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
        
        # 하루에 3번 실행: 11시, 16시, 21시
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
        print("✅ 네이버 증권 랭킹 데이터 수집 스케줄러 시작 (11시, 16시, 21시)")
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


async def collect_yahoo_kr_indices():
    """
    Yahoo Finance 국내지수(코스피/코스닥) 수집/저장
    - 09:20 / 11:00 / 13:00 / 15:30 (KST)
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

        # KR: 09:20, 11:00, 13:00, 15:30 (KST)
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
            CronTrigger(hour=11, minute=0, timezone=self.kst),
            id="yahoo_kr_1100",
            name="Yahoo KR Indices (11:00)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self.scheduler.add_job(
            collect_yahoo_kr_indices,
            CronTrigger(hour=13, minute=0, timezone=self.kst),
            id="yahoo_kr_1300",
            name="Yahoo KR Indices (13:00)",
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

        self.scheduler.start()
        print("✅ Yahoo 지수 수집 스케줄러 시작")
        print("   - US: 06:20 / 00:00 / 02:00 / 04:00 (KST)")
        print("   - KR: 09:20 / 11:00 / 13:00 / 15:30 (KST)")
        print("   - 최근 7일치만 유지\n")

    def shutdown(self):
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            print("✅ Yahoo 지수 수집 스케줄러 종료")


yahoo_index_scheduler = YahooIndexScheduler()


# 전역 스케줄러 인스턴스
naver_ranking_scheduler = NaverRankingScheduler()
