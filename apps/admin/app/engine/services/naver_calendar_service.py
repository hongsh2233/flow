"""
네이버 증권 증시 캘린더 스크래핑 서비스

실적발표, 경제지표, 주주총회, 테마성 이벤트 등을 수집합니다.

※ 2026년 기준 `scheduleMonthly.nhn`·`sise_market_cal.naver` 등 기존 URL이 HTTP 404로 응답하는 경우가 많습니다.
  (네이버 측 엔드포인트 폐기·이전) 이 경우 자동 수집은 0건이며, KRX 공모·BO 수동 일정으로 보완하세요.
  불필요한 요청을 끄려면 환경변수 NAVER_CALENDAR_ENABLED=0 을 설정합니다.
"""
import httpx
from bs4 import BeautifulSoup
from datetime import date as date_cls
from typing import Any, Dict, List, Optional, Tuple

from app.engine.models import Schedule
from app.config import NAVER_CALENDAR_ENABLED


def _parse_naver_schedule_monthly_json(year: int, month: int, payload: Any) -> List[Dict]:
    """모바일 JSON 응답 형식이 버전마다 달라서, 흔한 패턴만 방어적으로 파싱한다."""
    out: List[Dict] = []
    if not isinstance(payload, dict):
        return out

    def push(dstr: str, subject: str):
        sub = (subject or "").strip()
        if not sub:
            return
        out.append(
            {
                "date": dstr,
                "subject": sub,
                "content": "이슈 및 테마 일정 (네이버증권)",
                "type": "naver_cal",
            }
        )

    r = payload.get("result")
    if isinstance(r, dict):
        for key, val in r.items():
            if not (isinstance(key, str) and len(key) == 8 and key.isdigit()):
                continue
            y, mo, d = int(key[:4]), int(key[4:6]), int(key[6:8])
            if y != year or mo != month:
                continue
            dstr = f"{y}-{mo:02d}-{d:02d}"
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, str):
                        push(dstr, item)
                    elif isinstance(item, dict):
                        push(
                            dstr,
                            str(
                                item.get("title")
                                or item.get("subject")
                                or item.get("scheduleNm")
                                or item.get("name")
                                or ""
                            ),
                        )
            elif isinstance(val, str):
                push(dstr, val)
        if out:
            return out

    if isinstance(r, list):
        for item in r:
            if not isinstance(item, dict):
                continue
            raw_dt = (
                item.get("schedDt")
                or item.get("stdDt")
                or item.get("date")
                or item.get("trdDd")
                or ""
            )
            title = (
                item.get("title")
                or item.get("subject")
                or item.get("scheduleNm")
                or item.get("name")
                or ""
            )
            if isinstance(raw_dt, str) and len(raw_dt) >= 8 and raw_dt[:8].isdigit():
                y, mo, d = int(raw_dt[:4]), int(raw_dt[4:6]), int(raw_dt[6:8])
                if y == year and mo == month:
                    push(f"{y}-{mo:02d}-{d:02d}", str(title))
            elif isinstance(raw_dt, int):
                s = str(raw_dt)
                if len(s) == 8:
                    y, mo, d = int(s[:4]), int(s[4:6]), int(s[6:8])
                    if y == year and mo == month:
                        push(f"{y}-{mo:02d}-{d:02d}", str(title))
    return out


class NaverCalendarService:
    def __init__(self):
        self.base_url = "https://finance.naver.com"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        self.timeout = 30.0

    async def fetch_monthly_schedule(self, year: int, month: int) -> List[Dict]:
        """
        특정 월의 달력을 조회하여 일별 이벤트 파싱.
        모바일 JSON(scheduleMonthly.nhn)을 우선 시도하고, 실패 시 구 PC HTML(sise_market_cal)을 시도한다.
        """
        ym = f"{year}{month:02d}"
        results: List[Dict] = []

        if not NAVER_CALENDAR_ENABLED:
            return results

        json_url = f"https://m.stock.naver.com/api/json/sise/scheduleMonthly.nhn?month={ym}"
        json_headers = {
            **self.headers,
            "Referer": "https://m.stock.naver.com/",
            "Accept": "application/json, text/plain, */*",
        }

        json_was_404 = False
        json_other_error: Optional[Tuple[int, str]] = None

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout) as client:
                jr = await client.get(json_url, headers=json_headers)
                ct = (jr.headers.get("content-type") or "").lower()
                txt0 = (jr.text or "").lstrip()[:1]
                looks_json = "json" in ct or txt0 == "{"

                if not jr.is_success:
                    if jr.status_code == 404:
                        json_was_404 = True
                    else:
                        json_other_error = (jr.status_code, "JSON")
                elif jr.is_success and looks_json:
                    try:
                        results = _parse_naver_schedule_monthly_json(year, month, jr.json())
                    except Exception:
                        results = []
                    if not results:
                        print(
                            f"⚠️ 네이버 캘린더 JSON 성공({ym})이나 파싱 결과 0건 — 응답 스키마 변경 가능"
                        )
                elif jr.is_success and not looks_json:
                    print(
                        f"⚠️ 네이버 캘린더 JSON({ym}) 비 JSON 응답(content-type={ct!r}) — HTML 폴백 시도"
                    )

                if results:
                    print(f"✅ 네이버 증권 캘린더(JSON, {ym}) 파싱 완료: {len(results)}건")
                    return results

                html_url = f"{self.base_url}/sise/sise_market_cal.naver?ym={ym}"
                response = await client.get(html_url)
                html_404 = not response.is_success and response.status_code == 404

                if not response.is_success:
                    if json_was_404 and html_404:
                        print(
                            f"⚠️ 네이버 캘린더 ({ym}): JSON·PC 달력 모두 HTTP 404 — "
                            f"네이버 엔드포인트 폐기로 자동 수집 불가. "
                            f"KRX 공모·상장(BO 버튼) 및 수동 일정을 사용하거나 NAVER_CALENDAR_ENABLED=0 으로 요청을 끄세요."
                        )
                    elif json_was_404:
                        print(
                            f"⚠️ 네이버 캘린더 HTML HTTP {response.status_code} ({ym}) "
                            f"(JSON은 이미 404)"
                        )
                    elif json_other_error:
                        sc, _ = json_other_error
                        print(
                            f"⚠️ 네이버 캘린더 HTML HTTP {response.status_code} ({ym}) "
                            f"(JSON은 HTTP {sc})"
                        )
                    else:
                        print(
                            f"⚠️ 네이버 캘린더 HTML HTTP {response.status_code} ({ym}) "
                            f"— 이번 달 수집 0건"
                        )
                    return results

                soup = BeautifulSoup(
                    response.content.decode("euc-kr", "replace"), "html.parser"
                )
                cal_table = soup.find("table", class_="type_cal")
                if not cal_table:
                    print(
                        f"⚠️ 네이버 PC 달력 페이지({ym})에 table.type_cal 없음 — 마크업 변경 가능"
                    )
                    return results

                tds = cal_table.find_all("td")
                for td in tds:
                    day_item = td.find("span", class_="t_day") or td.find(
                        "strong", class_="t_day"
                    )
                    if not day_item:
                        day_item = td.find("div", class_="day") or td.find(
                            "span", class_="day"
                        )
                        if not day_item:
                            continue

                    day_text = day_item.get_text(strip=True)
                    if not day_text.isdigit():
                        continue

                    current_date = f"{year}-{month:02d}-{int(day_text):02d}"
                    ul = td.find("ul")
                    if ul:
                        for li in ul.find_all("li"):
                            subject = li.get_text(strip=True)
                            if subject:
                                results.append(
                                    {
                                        "date": current_date,
                                        "subject": subject,
                                        "content": "이슈 및 테마 일정 (네이버증권)",
                                        "type": "naver_cal",
                                    }
                                )

                print(f"✅ 네이버 증권 캘린더(HTML, {ym}) 파싱 완료: {len(results)}건")
                return results

        except Exception as e:
            print(f"❌ 네이버 캘린더 파싱 오류 ({ym}): {e}")
            return []

    def save_schedules_to_db(self, db_session, schedules: List[Dict]) -> int:
        """신규 삽입 건수만 반환 (기존 date+subject+type 중복은 스킵)."""
        try:
            saved_count = 0
            for item in schedules:
                d_raw = item.get("date")
                if isinstance(d_raw, str):
                    date_val = date_cls.fromisoformat(d_raw[:10])
                elif isinstance(d_raw, date_cls):
                    date_val = d_raw
                else:
                    continue
                existing = (
                    db_session.query(Schedule)
                    .filter(
                        Schedule.date == date_val,
                        Schedule.subject == item["subject"],
                        Schedule.type == "naver_cal",
                    )
                    .first()
                )

                if not existing:
                    new_sched = Schedule(
                        date=date_val,
                        subject=item["subject"],
                        content=item.get("content", ""),
                        type="naver_cal",
                        show_main_popup=False,
                    )
                    db_session.add(new_sched)
                    saved_count += 1

            db_session.commit()
            print(f"✅ 네이버 캘린더 DB 적재 완료 (신규추가: {saved_count}건)")
            return saved_count
        except Exception as e:
            db_session.rollback()
            print(f"❌ 네이버 캘린더 DB 적재 중 오류: {e}")
            return 0


naver_calendar_service = NaverCalendarService()
