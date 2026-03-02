"""
네이버 증권 수급 동향 스크래핑 서비스

수집 데이터:
  - 투자자별 매매동향 (시간별 / 일자별)
  - 수급 순위 (코스피/코스닥 외인·기관 순매수/매도)
  - 프로그램 매매 (시간별 / 일자별)
"""
import json
import httpx
from bs4 import BeautifulSoup, Tag
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import pytz

from app.models import NaverSupplyData


def get_last_trading_date() -> str:
    """
    가장 최근 거래일을 YYYYMMDD 형식으로 반환.
    오늘이 주말·공휴일이면 직전 평일로 거슬러 올라간다.
    공휴일(고정) 체크만 포함 — 음력 공휴일은 scheduler_service 쪽과 동일하게 최대 14일까지 후퇴.
    """
    from app.services.scheduler_service import is_weekend, is_korean_holiday

    kst = pytz.timezone("Asia/Seoul")
    candidate = datetime.now(kst)

    for _ in range(14):  # 최대 2주 이내에서 거래일 탐색
        if not is_weekend(candidate) and not is_korean_holiday(candidate):
            return candidate.strftime("%Y%m%d")
        candidate -= timedelta(days=1)

    # fallback: 그냥 오늘 날짜
    return datetime.now(kst).strftime("%Y%m%d")

BASE_URL = "https://finance.naver.com"

# URL별 정확한 Referer (iframe 페이지 차단 방지)
_REFERER = {
    "investor_time":  "https://finance.naver.com/sise/investorDealTrend.naver",
    "investor_day":   "https://finance.naver.com/sise/investorDealTrend.naver",
    "deal_rank":      "https://finance.naver.com/sise/sise_deal_rank.naver",
    "program_time":   "https://finance.naver.com/sise/programDealTrend.naver",
    "program_day":    "https://finance.naver.com/sise/programDealTrend.naver",
}

# 수집할 데이터 소스 정의
# (data_type, market, sub_key, url_path, url_params)
# bizdate 파라미터가 필요한 경우 url_params에 {bizdate} 포함
SUPPLY_SOURCES = [
    # 투자자별 매매동향 시간별
    ("investor_time", "all", None,
     "/sise/investorDealTrendTime.naver", {"bizdate": "{bizdate}"}),
    # 투자자별 매매동향 일자별
    ("investor_day", "all", None,
     "/sise/investorDealTrendDay.naver", {"bizdate": "{bizdate}"}),
    # 수급 순위 - 코스피 외인 순매수
    ("deal_rank", "kospi", "foreign_buy",
     "/sise/sise_deal_rank_iframe.naver",
     {"sosok": "01", "investor_gubun": "9000", "type": "buy"}),
    # 수급 순위 - 코스피 외인 순매도
    ("deal_rank", "kospi", "foreign_sell",
     "/sise/sise_deal_rank_iframe.naver",
     {"sosok": "01", "investor_gubun": "9000", "type": "sell"}),
    # 수급 순위 - 코스닥 외인 순매수
    ("deal_rank", "kosdaq", "foreign_buy",
     "/sise/sise_deal_rank_iframe.naver",
     {"sosok": "02", "investor_gubun": "9000", "type": "buy"}),
    # 수급 순위 - 코스닥 외인 순매도
    ("deal_rank", "kosdaq", "foreign_sell",
     "/sise/sise_deal_rank_iframe.naver",
     {"sosok": "02", "investor_gubun": "9000", "type": "sell"}),
    # 수급 순위 - 코스피 기관 순매수
    ("deal_rank", "kospi", "inst_buy",
     "/sise/sise_deal_rank_iframe.naver",
     {"sosok": "01", "investor_gubun": "1000", "type": "buy"}),
    # 수급 순위 - 코스피 기관 순매도
    ("deal_rank", "kospi", "inst_sell",
     "/sise/sise_deal_rank_iframe.naver",
     {"sosok": "01", "investor_gubun": "1000", "type": "sell"}),
    # 프로그램 매매 시간별
    ("program_time", "all", None,
     "/sise/programDealTrendTime.naver", {"bizdate": "{bizdate}"}),
    # 프로그램 매매 일자별
    ("program_day", "all", None,
     "/sise/programDealTrendDay.naver", {"bizdate": "{bizdate}"}),
]

_BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://finance.naver.com/",
}

# HEADERS는 fetch_supply_source 에서 data_type별로 Referer를 교체해 사용
HEADERS = _BASE_HEADERS


def _parse_table(soup: BeautifulSoup) -> dict:
    """
    HTML에서 테이블을 파싱하여 {"headers": [...], "rows": [[...]]} 반환.
    blank_08 클래스를 가진 행/셀은 제거.
    """
    # blank_08 행 제거
    for blank in soup.select("tr.blank_08, td.blank_08"):
        parent = blank.parent if isinstance(blank, Tag) else None
        if parent and parent.name == "tr":
            parent.decompose()
        elif blank.name == "tr":
            blank.decompose()

    # 테이블 찾기 (type1, type_1, type5 등 순서대로 시도)
    table = (
        soup.find("table", class_="type1")
        or soup.find("table", class_="type_1")
        or soup.find("table", class_="type5")
        or soup.find("table", class_="type_5")
        or soup.find("table")
    )
    if not table:
        return {"headers": [], "rows": []}

    headers: list[str] = []
    rows: list[list[str]] = []

    # thead 파싱 (multi-row 헤더 처리: rowspan/colspan 무시하고 텍스트만 수집)
    thead = table.find("thead")
    if thead:
        for tr in thead.find_all("tr"):
            for th in tr.find_all(["th", "td"]):
                text = th.get_text(strip=True)
                if text:
                    headers.append(text)
    else:
        # thead 없으면 첫 tr을 헤더로
        first_tr = table.find("tr")
        if first_tr:
            for th in first_tr.find_all(["th", "td"]):
                text = th.get_text(strip=True)
                if text:
                    headers.append(text)

    # tbody 파싱
    tbody = table.find("tbody") or table
    for tr in tbody.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        # blank_08 행 건너뜀
        if any("blank_08" in c.get("class", []) for c in cells):
            continue
        row_text = [c.get_text(strip=True) for c in cells]
        # 내용이 없는 행 건너뜀
        if not any(row_text):
            continue
        rows.append(row_text)

    return {"headers": headers, "rows": rows}


async def fetch_supply_source(
    data_type: str,
    market: str,
    sub_key: Optional[str],
    url_path: str,
    url_params: dict,
    bizdate: str,
    timeout: float = 20.0,
) -> dict:
    """단일 수급 URL을 스크래핑하여 파싱된 dict 반환"""
    # bizdate 치환
    params = {
        k: (v.replace("{bizdate}", bizdate) if isinstance(v, str) else v)
        for k, v in url_params.items()
    }
    url = BASE_URL + url_path

    # URL별 정확한 Referer 설정 (iframe 페이지 차단 방지)
    headers = {**_BASE_HEADERS, "Referer": _REFERER.get(data_type, "https://finance.naver.com/")}

    async with httpx.AsyncClient(
        headers=headers, timeout=timeout, follow_redirects=True
    ) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
        except Exception as e:
            print(f"  ⚠️ [{data_type}/{market}/{sub_key}] 요청 실패: {e}")
            return {}

    # Naver는 EUC-KR 인코딩 사용
    try:
        content = response.content.decode("euc-kr", errors="replace")
    except Exception:
        content = response.text

    soup = BeautifulSoup(content, "html.parser")
    parsed = _parse_table(soup)
    return parsed


def save_supply_data(
    db: Session,
    data_type: str,
    market: str,
    sub_key: Optional[str],
    parsed: dict,
    bizdate: str,
    collected_time: str,
    collected_at: datetime,
) -> bool:
    """파싱된 수급 데이터를 DB에 upsert"""
    if not parsed or not parsed.get("rows"):
        return False
    try:
        data_json = json.dumps(parsed, ensure_ascii=False)
        # 기존 레코드 확인 (unique 제약 기준으로 upsert)
        existing = db.query(NaverSupplyData).filter(
            NaverSupplyData.data_type == data_type,
            NaverSupplyData.market == market,
            NaverSupplyData.sub_key == sub_key,
            NaverSupplyData.bizdate == bizdate,
            NaverSupplyData.collected_time == collected_time,
        ).first()

        if existing:
            existing.data_json = data_json
            existing.collected_at = collected_at
        else:
            db.add(NaverSupplyData(
                data_type=data_type,
                market=market,
                sub_key=sub_key,
                data_json=data_json,
                bizdate=bizdate,
                collected_time=collected_time,
                collected_at=collected_at,
            ))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"  ❌ DB 저장 오류 [{data_type}/{market}/{sub_key}]: {e}")
        return False


def cleanup_old_supply_data(db: Session, keep_days: int = 5) -> None:
    """6일차 도래 시 가장 오래된 bizdate 삭제 (5일치 유지)"""
    try:
        from sqlalchemy import text as sqla_text
        result = db.execute(sqla_text(
            "SELECT DISTINCT bizdate FROM naver_supply_data ORDER BY bizdate DESC"
        ))
        bizdates = [row[0] for row in result]
        if len(bizdates) > keep_days:
            to_delete = bizdates[keep_days:]
            db.query(NaverSupplyData).filter(
                NaverSupplyData.bizdate.in_(to_delete)
            ).delete(synchronize_session=False)
            db.commit()
            print(f"  🗑️ 오래된 수급 데이터 삭제: {to_delete}")
    except Exception as e:
        db.rollback()
        print(f"  ❌ 수급 데이터 정리 오류: {e}")


async def collect_all_supply_data(
    db: Session,
    bizdate: Optional[str] = None,
    collected_time: Optional[str] = None,
) -> int:
    """
    모든 수급 동향 데이터 수집 및 저장.
    - bizdate: 수집 기준 거래일 (YYYYMMDD). None 이면 오늘 날짜 사용 (스케줄러용)
    - collected_time: 저장 시각 레이블. None 이면 현재 시 기준 :30 사용.
                      수동 수집 시에는 'manual' 을 권장.
    반환값: 성공 건수
    """
    kst = pytz.timezone("Asia/Seoul")
    now = datetime.now(kst)
    if bizdate is None:
        bizdate = now.strftime("%Y%m%d")
    if collected_time is None:
        # 1시간 단위 기준으로 저장 (ex. 09:37 → '09:30', 스케줄이 매 시 30분에 실행)
        collected_time = f"{now.hour:02d}:30"

    success = 0
    for (data_type, market, sub_key, url_path, url_params) in SUPPLY_SOURCES:
        label = f"{data_type}/{market}/{sub_key or '-'}"
        print(f"  🔄 수급 수집: {label}")
        try:
            parsed = await fetch_supply_source(
                data_type, market, sub_key, url_path, url_params, bizdate
            )
            if parsed and parsed.get("rows"):
                saved = save_supply_data(
                    db, data_type, market, sub_key,
                    parsed, bizdate, collected_time, now
                )
                if saved:
                    success += 1
                    print(f"  ✅ 저장 완료: {label} ({len(parsed['rows'])}행)")
            else:
                print(f"  ⚠️ 데이터 없음: {label}")
        except Exception as e:
            print(f"  ❌ 수집 오류: {label} → {e}")

    # 5일 초과 시 오래된 데이터 삭제
    cleanup_old_supply_data(db)
    return success
