"""
Open DART(금융감독원 전자공시) API로 공모청약 일정 수집
- list.json: 발행공시(증권신고 지분증권) 목록 조회 → corp_code 수집
- estkRs.json: 지분증권 상세(청약기일, 납입기일, 인수인) 조회
참고: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS006&apiId=2020054
"""
import re
import pytz
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Any

import httpx


LIST_API = "https://opendart.fss.or.kr/api/list.json"
ESTK_RS_API = "https://opendart.fss.or.kr/api/estkRs.json"
DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"

# 발행공시 > 증권신고(지분증권), 소액공모(지분증권)
PBLNTF_TY = "C"
PBLNTF_DETAIL_C001 = "C001"  # 증권신고(지분증권)
PBLNTF_DETAIL_C006 = "C006"  # 소액공모(지분증권)


def _parse_yyyymmdd(s: Optional[str]) -> Optional[date]:
    """YYYYMMDD 문자열을 date로."""
    if not s or len(s) < 8:
        return None
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None


def _first_date_from_range(s: Optional[str]) -> Optional[date]:
    """청약기일/납입기일 문자열에서 첫 날짜 추출. 예: 20260220 또는 20260220~20260223."""
    if not s or not s.strip():
        return None
    s = s.strip()
    m = re.match(r"(\d{8})", s)
    if m:
        return _parse_yyyymmdd(m.group(1))
    return None


async def _fetch_list_page(
    client: httpx.AsyncClient,
    api_key: str,
    bgn_de: str,
    end_de: str,
    pblntf_detail_ty: str,
    page_no: int = 1,
    page_count: int = 100,
) -> Dict[str, Any]:
    """공시 목록 1페이지 조회."""
    resp = await client.get(
        LIST_API,
        params={
            "crtfc_key": api_key,
            "bgn_de": bgn_de,
            "end_de": end_de,
            "pblntf_ty": PBLNTF_TY,
            "pblntf_detail_ty": pblntf_detail_ty,
            "page_no": page_no,
            "page_count": page_count,
        },
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()


async def _fetch_estk_rs(
    client: httpx.AsyncClient,
    api_key: str,
    corp_code: str,
    bgn_de: str,
    end_de: str,
) -> Dict[str, Any]:
    """지분증권(estkRs) 상세 조회 - 청약기일, 납입기일, 인수인 등."""
    resp = await client.get(
        ESTK_RS_API,
        params={
            "crtfc_key": api_key,
            "corp_code": corp_code,
            "bgn_de": bgn_de,
            "end_de": end_de,
        },
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()


def _extract_ipo_from_estk_rs(
    data: Dict[str, Any],
    corp_name_from_list: str,
    rcept_no: str,
) -> List[Dict[str, Any]]:
    """
    estkRs 응답에서 일반사항(청약기일 sbd, 납입기일 pymd)과 인수인정보(actnmn) 추출.
    응답 구조: result.group[] -> title, list[] -> 필드들.
    """
    results = []
    if data.get("status") != "000" or "result" not in data:
        return results
    res = data["result"]
    if not isinstance(res, dict):
        return results
    groups = res.get("group") or []
    general = None  # 일반사항
    underwriters = []  # 인수인정보

    for g in groups:
        if not isinstance(g, dict):
            continue
        title = (g.get("title") or "").strip()
        items = g.get("list") or []
        if not items:
            continue
        if "일반사항" in title:
            general = items[0] if items else None
        elif "인수인" in title:
            for it in items:
                actnmn = (it.get("actnmn") or "").strip()
                if actnmn:
                    underwriters.append(actnmn)

    if not general:
        return results

    sbd = (general.get("sbd") or "").strip()  # 청약기일
    pymd = (general.get("pymd") or "").strip()  # 납입기일
    corp_name = (general.get("corp_name") or corp_name_from_list or "").strip()

    start_date = _first_date_from_range(sbd) or _first_date_from_range(pymd)
    if not start_date:
        return results

    period_str = sbd or pymd or "-"
    if sbd and pymd and sbd != pymd:
        period_str = f"{sbd}~{pymd}"
    underwriter_str = ",".join(underwriters) if underwriters else "-"
    link_url = DART_VIEWER_URL.format(rcept_no=rcept_no) if rcept_no else None

    results.append({
        "company_name": corp_name,
        "period": period_str,
        "price": "-",  # estkRs에는 희망공모가가 다른 그룹에 있을 수 있음
        "underwriter": underwriter_str,
        "date": start_date,
        "link_url": link_url,
        "rcept_no": rcept_no,
    })
    return results


async def fetch_ipo_schedules_opendart(
    api_key: str,
    months_back: int = 3,
) -> List[Dict[str, Any]]:
    """
    Open DART로 공모청약(지분증권) 일정 수집.
    1) list.json으로 증권신고(지분증권) 공시 목록 조회 (최대 3개월)
    2) 각 corp_code별로 estkRs 조회해 청약기일·인수인 등 추출
    """
    if not api_key or len(api_key) < 10:
        return []

    end = datetime.now(pytz.timezone("Asia/Seoul")).date()
    start = end - timedelta(days=min(months_back * 31, 90))
    bgn_de = start.strftime("%Y%m%d")
    end_de = end.strftime("%Y%m%d")

    # 1) 공시 목록 수집 (C001 지분증권, C006 소액공모 지분증권)
    seen_corp = set()
    list_entries: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=25.0) as client:
        for detail_ty in (PBLNTF_DETAIL_C001, PBLNTF_DETAIL_C006):
            page_no = 1
            while True:
                try:
                    body = await _fetch_list_page(
                        client, api_key, bgn_de, end_de, detail_ty, page_no=page_no
                    )
                except httpx.HTTPError as e:
                    print(f"[Open DART] list.json 오류: {e}")
                    break
                if body.get("status") != "000":
                    print(f"[Open DART] list.json status: {body.get('message', body)}")
                    break
                items = body.get("list") or []
                if not items:
                    break
                for it in items:
                    corp_code = (it.get("corp_code") or "").strip()
                    if not corp_code or corp_code in seen_corp:
                        continue
                    seen_corp.add(corp_code)
                    list_entries.append({
                        "corp_code": corp_code,
                        "corp_name": (it.get("corp_name") or "").strip(),
                        "rcept_no": (it.get("rcept_no") or "").strip(),
                        "rcept_dt": (it.get("rcept_dt") or "").strip(),
                    })
                total_page = int(body.get("total_page") or 1)
                if page_no >= total_page:
                    break
                page_no += 1

        # 2) 각 회사별 estkRs 조회
        all_rows: List[Dict[str, Any]] = []
        for ent in list_entries:
            corp_code = ent["corp_code"]
            corp_name = ent["corp_name"]
            rcept_no = ent["rcept_no"]
            try:
                body = await _fetch_estk_rs(client, api_key, corp_code, bgn_de, end_de)
            except httpx.HTTPError as e:
                print(f"[Open DART] estkRs 오류 {corp_name}({corp_code}): {e}")
                continue
            if body.get("status") == "013":
                continue  # 조회된 데이터 없음
            if body.get("status") != "000":
                continue
            rows = _extract_ipo_from_estk_rs(body, corp_name, rcept_no)
            for r in rows:
                key = (r.get("company_name"), r.get("date"))
                if not any((x.get("company_name"), x.get("date")) == key for x in all_rows):
                    all_rows.append(r)

    # subject/content 형식: 기존 38·Schedule 스키마와 맞춤
    out = []
    for r in all_rows:
        company = r.get("company_name") or ""
        period = r.get("period") or "-"
        price = r.get("price") or "-"
        underwriter = r.get("underwriter") or "-"
        start_date = r.get("date")
        if not company or not start_date:
            continue
        subject = f"{company} 청약"
        content = f"청약기간 {period}"
        if price != "-":
            content += f" / 희망공모가 {price}"
        if underwriter != "-":
            content += f" / {underwriter}"
        out.append({
            "company_name": company,
            "period": period,
            "price": price,
            "underwriter": underwriter,
            "date": start_date,
            "link_url": r.get("link_url"),
            "subject": subject,
            "content": content.strip(),
        })
    return out
