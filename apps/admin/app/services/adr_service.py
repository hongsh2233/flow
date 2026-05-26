"""
ADR(Advance-Decline Ratio) 지표 계산 서비스

ADR은 20일 이동평균 방식으로 상승 종목 수 / 하락 종목 수 비율을 백분율로 표현
- 120% 이상: OVERBOUGHT (과열)
- 75% 이하: OVERSOLD (침체/기회)
- 그 외: NEUTRAL (보통)
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.engine.models import AdvancingDecliningCount
import pytz


def calculate_adr_20(db: Session, market: str, target_date: str = None) -> dict:
    """
    20일 이동평균 ADR 계산

    Args:
        db: SQLAlchemy 세션
        market: 'kospi' | 'kosdaq'
        target_date: 기준 날짜 (YYYYMMDD, 기본값: 오늘)

    Returns:
        {
            'date': str (YYYYMMDD),
            'market': str,
            'adr_value': float,
            'status': 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL',
            'advancing': int,
            'declining': int,
            'sum_adv_20d': int,
            'sum_dec_20d': int,
            'data_points': int
        }
    """
    if not target_date:
        kst = pytz.timezone("Asia/Seoul")
        target_date = datetime.now(kst).strftime("%Y%m%d")

    # 20일 이전 날짜 계산
    target_dt = datetime.strptime(target_date, "%Y%m%d")
    start_dt = target_dt - timedelta(days=20)
    start_date = start_dt.strftime("%Y%m%d")

    # 해당 기간의 데이터 조회
    records = db.query(AdvancingDecliningCount).filter(
        and_(
            AdvancingDecliningCount.market == market,
            AdvancingDecliningCount.bizdate >= start_date,
            AdvancingDecliningCount.bizdate <= target_date,
        )
    ).order_by(AdvancingDecliningCount.bizdate).all()

    if not records:
        return {
            'date': target_date,
            'market': market,
            'adr_value': None,
            'status': 'NO_DATA',
            'advancing': 0,
            'declining': 0,
            'sum_adv_20d': 0,
            'sum_dec_20d': 0,
            'data_points': 0,
        }

    # 20일 합계 계산
    sum_adv = sum(r.advancing_count for r in records)
    sum_dec = sum(r.declining_count for r in records)

    # 최근 데이터 (당일)
    latest = records[-1]

    # ADR 계산 (0 division 방지)
    if sum_dec == 0:
        adr_value = 100.0 if sum_adv > 0 else 0.0
    else:
        adr_value = (sum_adv / sum_dec) * 100

    # 상태 판정
    if adr_value >= 120:
        status = 'OVERBOUGHT'
    elif adr_value <= 75:
        status = 'OVERSOLD'
    else:
        status = 'NEUTRAL'

    return {
        'date': target_date,
        'market': market,
        'adr_value': round(adr_value, 2),
        'status': status,
        'advancing': latest.advancing_count,
        'declining': latest.declining_count,
        'unchanged': latest.unchanged_count,
        'sum_adv_20d': sum_adv,
        'sum_dec_20d': sum_dec,
        'data_points': len(records),
    }


def get_adr_indicator(db: Session, target_date: str = None) -> dict:
    """
    코스피와 코스닥 모두의 ADR 지표 계산

    Returns:
        {
            'success': bool,
            'data': {
                'kospi': {...},
                'kosdaq': {...}
            }
        }
    """
    kospi_result = calculate_adr_20(db, 'kospi', target_date)
    kosdaq_result = calculate_adr_20(db, 'kosdaq', target_date)

    return {
        'success': True,
        'data': {
            'kospi': kospi_result,
            'kosdaq': kosdaq_result,
        }
    }
