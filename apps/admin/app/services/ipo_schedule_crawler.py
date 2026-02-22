"""
38커뮤니케이션(38.co.kr) IPO 청약일정 크롤링
- 기업명, 청약기간, 희망공모가, 주관 증권사만 수집
- 상세 링크는 수집하지 않음
"""
import re
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from datetime import date


BASE_URL = "https://www.38.co.kr/html/fund/index.htm"
# 공모주 2차 청약신청 목록 (o=k), 페이지네이션 page=1,2,...
LIST_PARAMS = {"o": "k"}


def _parse_period_to_start_date(period_str: str) -> Optional[date]:
    """청약기간 문자열에서 시작일 추출. 예: 2026.02.20~02.23 -> date(2026,2,20)"""
    if not period_str or not period_str.strip():
        return None
    s = period_str.strip()
    # 2026.02.20~02.23 또는 2026.02.20-02.23 또는 2026.03.23\~03.24
    m = re.match(r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    return None


def _normalize_cell(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.split()).strip()


def _extract_row_cells(row) -> List[str]:
    """tr에서 td 텍스트만 추출 (a 태그는 텍스트만)"""
    cells = []
    for td in row.find_all(["td", "th"]):
        cells.append(_normalize_cell(td.get_text(strip=True)))
    return cells


def _looks_like_period(s: str) -> bool:
    """청약기간 형식인지 (예: 2026.02.20~02.23)"""
    return bool(re.search(r"\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}", s)) if s else False


def _looks_like_price(s: str) -> bool:
    """희망공모가 형식 (숫자, 콤마, ~)"""
    if not s or len(s) > 50:
        return False
    return bool(re.search(r"[\d,~\-]+", s)) and not re.search(r"[가-힣]{3,}", s)


def _looks_like_underwriter(s: str) -> bool:
    """주관사 (증권사명, 쉼표로 구분)"""
    return "증권" in s or ("," in s and len(s) >= 2) if s else False


def _parse_row_by_pattern(cells: List[str]) -> Optional[Dict[str, str]]:
    """한 행의 셀 리스트에서 패턴으로 기업명/청약기간/희망공모가/주관사 추출."""
    period_str = None
    price_str = None
    underwriter_str = None
    company_candidates = []
    for c in cells:
        c = _normalize_cell(c)
        if not c or len(c) > 200:
            continue
        if _looks_like_period(c):
            period_str = c
        elif _looks_like_underwriter(c):
            underwriter_str = c
        elif _looks_like_price(c) and not _looks_like_period(c):
            price_str = c
        else:
            # 기업명 후보: 한글/영문 포함, "분석" 등 제외
            if "분석" not in c and "보기" != c.strip() and not c.isdigit():
                company_candidates.append(c)
    if not period_str or _parse_period_to_start_date(period_str) is None:
        return None
    company = company_candidates[0] if company_candidates else ""
    if not company:
        return None
    return {
        "company_name": company,
        "period": period_str,
        "price": price_str or "-",
        "underwriter": underwriter_str or "-",
    }


def _parse_38_fund_table_row(cells: List[str]) -> Optional[Dict[str, str]]:
    """
    38.co.kr 공모청약일정 테이블 실제 컬럼 순서:
    0: 종목명(기업명), 1: 청약기간, 2: 확정공모가, 3: 희망공모가, 4: 청약경쟁률, 5: 주간사, 6: 분석
    (6열인 경우: 4번 없을 수 있음 → 0,1,2,3,4=주간사,5=분석)
    """
    if len(cells) < 5:
        return None
    c0 = _normalize_cell(cells[0])  # 기업명
    c1 = _normalize_cell(cells[1])  # 청약기간
    if not c0 or not _looks_like_period(c1) or _parse_period_to_start_date(c1) is None:
        return None
    # 희망공모가: 7열이면 cells[3], 6열이면 cells[2] 또는 [3]
    price = "-"
    underwriter = "-"
    if len(cells) >= 7:
        price = _normalize_cell(cells[3]) or _normalize_cell(cells[2]) or "-"
        underwriter = _normalize_cell(cells[5]) or "-"
    elif len(cells) >= 6:
        # 6열: 기업명, 청약기간, 확정, 희망, 주간사, 분석
        price = _normalize_cell(cells[3]) if _looks_like_price(cells[3]) else (_normalize_cell(cells[2]) or "-")
        underwriter = _normalize_cell(cells[4]) or "-"
    elif len(cells) == 5:
        price = _normalize_cell(cells[2]) if _looks_like_price(cells[2]) else "-"
        underwriter = _normalize_cell(cells[4]) if _looks_like_underwriter(cells[4]) else "-"
    if not price or price == "분석":
        price = "-"
    if underwriter and ("분석" in underwriter or underwriter == "보기"):
        underwriter = "-"
    return {
        "company_name": c0,
        "period": c1,
        "price": price,
        "underwriter": underwriter,
    }


def _parse_row_from_fund_link(link, row_cells: List[str]) -> Optional[Dict[str, str]]:
    """기업 상세 링크(o=v&no=)가 있는 행에서 셀 리스트로 레코드 생성."""
    company = _normalize_cell(link.get_text(strip=True))
    if not company or "분석" in company or company == "보기":
        return None
    # 38.co.kr 실제 테이블 7열 구조 우선 적용
    rec = _parse_38_fund_table_row(row_cells)
    if rec:
        rec["company_name"] = company
        return rec
    parsed = _parse_row_by_pattern(row_cells)
    if parsed:
        parsed["company_name"] = company
        return parsed
    return None


def _parse_single_cell_line(line: str) -> Optional[Dict[str, str]]:
    """한 셀에 '기업명 2026.02.20~02.23 - 12,100~16,600 NH투자증권' 형태로 있을 때."""
    if not line or len(line) > 500:
        return None
    # 청약기간: YYYY.MM.DD~MM.DD 또는 YYYY.MM.DD\~MM.DD 또는 YYYY.MM.DD-MM.DD
    period_m = re.search(r"(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*[\\~\-]\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{1,2})?)", line)
    if not period_m or _parse_period_to_start_date(period_m.group(1)) is None:
        return None
    period_str = period_m.group(0).replace("\\", "").replace("\u2013", "~").replace("\u2014", "~").strip()
    # 가격: 숫자,쉼표,~ (기간 다음에 오는 부분). 예: - 12,100~16,600 또는 \u2013 2,000~2,000
    rest_after_period = line[period_m.end() :].strip()
    price_str = "-"
    underwriter_str = "-"
    price_m = re.search(r"[-\s\u2013\u2014]+\s*([\d,]+(?:\s*[~\-\u2013]\s*[\d,]+)?)", rest_after_period)
    if price_m:
        price_str = _normalize_cell(price_m.group(1))
        rest_after_period = rest_after_period[price_m.end() :].strip()
    # 나머지는 주관사 (증권 포함 또는 쉼표). 끝의 '분석보기' 등 제거
    if rest_after_period and ("," in rest_after_period or "증권" in rest_after_period or len(rest_after_period) > 2):
        uw = _normalize_cell(rest_after_period).replace("분석보기", "").replace("[", "").replace("]", "").strip()
        underwriter_str = uw if uw else "-"
    # 기업명: 기간 앞 부분 (링크 텍스트만 올 수 있음)
    before_period = line[: period_m.start()].strip()
    company = _normalize_cell(before_period)
    if not company or "분석" in company:
        return None
    return {
        "company_name": company,
        "period": period_str,
        "price": price_str,
        "underwriter": underwriter_str,
    }


def _parse_table_rows(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """
    테이블에서 행별로 기업명, 청약기간, 희망공모가, 주관사 추출.
    - 전략 1: o=v&no= 링크로 데이터 행 찾은 뒤 같은 행 셀에서 패턴 파싱
    - 전략 2: 한 셀에 전체 라인이 있는 경우 _parse_single_cell_line
    - 전략 3: 기존 테이블 tr/td 고정 순서 및 패턴 매칭
    """
    results = []
    seen_keys = set()

    # 전략 1: 공모 상세 링크(fund/?o=v&no=)가 있는 a 태그로 행 탐색
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "o=v" not in href or "no=" not in href or "fund" not in href:
            continue
        row = a.find_parent("tr")
        if not row:
            # td 안에만 있을 수 있음 -> 부모 td의 텍스트 전체로 파싱
            parent_td = a.find_parent(["td", "th"])
            if parent_td:
                line = _normalize_cell(parent_td.get_text(strip=True))
                rec = _parse_single_cell_line(line)
                if rec:
                    key = (rec["company_name"], rec.get("period"))
                    if key not in seen_keys:
                        seen_keys.add(key)
                        results.append(rec)
            continue
        cells = _extract_row_cells(row)
        if len(cells) >= 3:
            rec = _parse_row_from_fund_link(a, cells)
            if rec:
                key = (rec["company_name"], rec.get("period"))
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append(rec)
        else:
            # 행이 셀 하나에 다 들어있는 경우
            line = _normalize_cell(row.get_text(strip=True))
            rec = _parse_single_cell_line(line)
            if rec:
                key = (rec["company_name"], rec.get("period"))
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append(rec)

    if results:
        return results

    # 전략 2/3: 기존 테이블 순회
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for tr in rows:
            cells = _extract_row_cells(tr)
            if len(cells) < 3:
                # 한 셀에 전체 라인
                full = _normalize_cell(tr.get_text(strip=True))
                rec = _parse_single_cell_line(full)
                if rec and (rec["company_name"], rec.get("period")) not in seen_keys:
                    seen_keys.add((rec["company_name"], rec.get("period")))
                    results.append(rec)
                continue
            # 38.co.kr 실제 7열: 기업명, 청약기간, 확정공모가, 희망공모가, 청약경쟁률, 주간사, 분석
            if len(cells) >= 5:
                rec = _parse_38_fund_table_row(cells)
                if rec and rec["company_name"] and rec["period"]:
                    key = (rec["company_name"], rec["period"])
                    if key not in seen_keys:
                        seen_keys.add(key)
                        results.append(rec)
                    continue
            if len(cells) >= 4:
                c0, c1, c2, c3 = cells[0], cells[1], cells[2], cells[3]
                if _looks_like_period(c1) and _parse_period_to_start_date(c1):
                    rec = {
                        "company_name": c0,
                        "period": c1,
                        "price": c2 if _looks_like_price(c2) or c2.strip() in ("-", "") else c2,
                        "underwriter": c3,
                    }
                    if rec["company_name"] and rec["period"]:
                        key = (rec["company_name"], rec["period"])
                        if key not in seen_keys:
                            seen_keys.add(key)
                            results.append(rec)
                    continue
            parsed = _parse_row_by_pattern(cells)
            if parsed:
                key = (parsed["company_name"], parsed.get("period"))
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append(parsed)
    return results


async def fetch_ipo_schedules_38(max_pages: int = 5) -> List[Dict]:
    """
    38.co.kr 공모주 2차 청약신청 목록에서 기업명, 청약기간, 희망공모가, 주관사만 수집.
    Returns:
        List[Dict]: 각 항목은 company_name, period, price, underwriter, date(시작일)
    """
    all_rows: List[Dict[str, str]] = []
    timeout = 20.0
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    }
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        for page in range(1, max_pages + 1):
            params = {**LIST_PARAMS, "page": str(page)}
            try:
                resp = await client.get(BASE_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                print(f"[IPO 크롤러] 38.co.kr 요청 실패 page={page}: {e}")
                break
            # 인코딩: 38.co.kr은 EUC-KR 사용 가능성
            if resp.encoding in (None, "ISO-8859-1"):
                resp.encoding = "euc-kr"
            try:
                text = resp.text
            except Exception as e:
                print(f"[IPO 크롤러] 디코딩 실패 page={page}: {e}")
                break
            soup = BeautifulSoup(text, "html.parser")
            rows = _parse_table_rows(soup)
            if not rows:
                break
            for r in rows:
                start_date = _parse_period_to_start_date(r["period"])
                if start_date:
                    r["date"] = start_date
                    all_rows.append(r)
            # 다음 페이지에 데이터가 없으면 종료
            if len(rows) < 5:
                break
    # 중복 제거 (기업명+시작일 기준)
    seen = set()
    unique = []
    for r in all_rows:
        key = (r.get("company_name", ""), r.get("date"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    return unique
