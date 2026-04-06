"""
네이버 데이터랩 검색어 트렌드 API 서비스
https://developers.naver.com/docs/serviceapi/datalab/search/search.md

환경변수: Naver_trend (Client ID), Naver_trend_Secret (Client Secret)
"""

import json
import httpx
from datetime import date, datetime, timedelta
from typing import Optional

import pytz

from app.config import NAVER_TREND_CLIENT_ID, NAVER_TREND_CLIENT_SECRET

KST = pytz.timezone("Asia/Seoul")

API_URL = "https://openapi.naver.com/v1/datalab/search"

# 주식 투자 관련 주요 키워드 그룹
DEFAULT_KEYWORD_GROUPS = [
    {"groupName": "주식", "keywords": ["주식", "주식투자", "주식매매"]},
    {"groupName": "코스피", "keywords": ["코스피", "KOSPI", "코스피지수"]},
    {"groupName": "코스닥", "keywords": ["코스닥", "KOSDAQ", "코스닥지수"]},
    {"groupName": "ETF", "keywords": ["ETF", "상장지수펀드", "ETF추천"]},
    {"groupName": "부동산", "keywords": ["부동산", "아파트", "부동산투자"]},
    {"groupName": "금리", "keywords": ["금리", "기준금리", "금리인하"]},
    {"groupName": "환율", "keywords": ["환율", "달러환율", "원달러"]},
    {"groupName": "비트코인", "keywords": ["비트코인", "암호화폐", "가상화폐"]},
    {"groupName": "IPO", "keywords": ["IPO", "공모주", "공모주청약"]},
    {"groupName": "배당", "keywords": ["배당금", "배당주", "고배당"]},
]


async def fetch_search_trend(
    keyword_groups: list[dict],
    start_date: str,
    end_date: str,
    time_unit: str = "date",
) -> Optional[dict]:
    """
    네이버 데이터랩 통합 검색어 트렌드 조회

    Args:
        keyword_groups: [{"groupName": str, "keywords": [str]}]
        start_date: "yyyy-mm-dd"
        end_date: "yyyy-mm-dd"
        time_unit: "date" | "week" | "month"

    Returns:
        API 응답 dict 또는 None
    """
    if not NAVER_TREND_CLIENT_ID or not NAVER_TREND_CLIENT_SECRET:
        print("[검색트렌드] Naver_trend / Naver_trend_Secret 환경변수 미설정")
        return None

    headers = {
        "X-Naver-Client-Id": NAVER_TREND_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_TREND_CLIENT_SECRET,
        "Content-Type": "application/json",
    }

    body = {
        "startDate": start_date,
        "endDate": end_date,
        "timeUnit": time_unit,
        "keywordGroups": keyword_groups,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(API_URL, headers=headers, json=body)
        if resp.status_code != 200:
            print(f"[검색트렌드] API 오류: {resp.status_code} {resp.text[:200]}")
            return None
        return resp.json()


async def collect_search_trends(db, time_unit: str = "date") -> int:
    """
    검색어 트렌드 수집 + DB 저장

    Args:
        db: SQLAlchemy Session
        time_unit: "date" (일간, 최근 30일) | "week" (주간, 최근 12주) | "month" (월간, 최근 12개월)

    Returns:
        저장된 키워드 그룹 수
    """
    from app.engine.models import NaverSearchTrend

    now = datetime.now(KST)
    today = now.date()

    if time_unit == "date":
        start = today - timedelta(days=30)
    elif time_unit == "week":
        start = today - timedelta(weeks=12)
    else:  # month
        start = today.replace(year=today.year - 1, month=today.month, day=1)

    start_str = start.strftime("%Y-%m-%d")
    end_str = today.strftime("%Y-%m-%d")

    # API는 최대 5개 키워드 그룹까지 → 2번 나눠서 호출
    saved = 0
    for i in range(0, len(DEFAULT_KEYWORD_GROUPS), 5):
        batch = DEFAULT_KEYWORD_GROUPS[i : i + 5]
        result = await fetch_search_trend(batch, start_str, end_str, time_unit)
        if not result or "results" not in result:
            continue

        for item in result["results"]:
            trend = NaverSearchTrend(
                time_unit=time_unit,
                keyword_group=item["title"],
                keywords=json.dumps(item["keywords"], ensure_ascii=False),
                start_date=result.get("startDate", start_str),
                end_date=result.get("endDate", end_str),
                data_json=json.dumps(item["data"], ensure_ascii=False),
                collected_at=now,
            )
            db.add(trend)
            saved += 1

    if saved:
        db.commit()

    print(f"[검색트렌드] {time_unit} 수집 완료: {saved}개 그룹 ({start_str} ~ {end_str})")
    return saved
