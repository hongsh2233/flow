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


def _parse_table_rows(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """
    테이블에서 행별로 기업명, 청약기간, 희망공모가, 주관사 추출.
    컬럼 순서가 [기업명, 청약기간, 희망공모가, 주관사] 형태이거나,
    패턴 매칭으로 각 필드를 식별.
    """
    results = []
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for tr in rows:
            cells = _extract_row_cells(tr)
            if len(cells) < 3:
                continue
            # 먼저 고정 순서 시도: 기업명, 청약기간, 희망공모가, 주관사 (나머지 열 무시)
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
                        results.append(rec)
                        continue
            # 패턴으로 재해석
            parsed = _parse_row_by_pattern(cells)
            if parsed:
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
