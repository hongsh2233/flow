"""
한국거래소 (KRX KIND) 기업공시채널 데이터 스크래핑 서비스

공모주 청약/상장 일정, 기업 이벤트(무상증자, 휴장일 등) 데이터를 수집합니다.
"""
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from datetime import date as date_cls
import re

from app.engine.models import Schedule


def _first_yyyy_mm_dd(s: str) -> Optional[str]:
    m = re.search(r"(\d{4})[.\-](\d{2})[.\-](\d{2})", s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


class KrxKindService:
    def __init__(self):
        self.base_url = "https://kind.krx.co.kr"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        self.timeout = 30.0

    async def fetch_ipo_schedules(self) -> List[Dict]:
        """
        KRX KIND 상장일정(공모주) 데이터를 크롤링합니다.
        Returns:
            List[Dict]: [{'date': 'YYYY-MM-DD', 'subject': '...', 'underwriter': '...'}, ...]
        """
        url = f"{self.base_url}/listinvstg/pubofrprogcom.do"
        # Main(method=searchPubofrProgComMain) 은 검색 폼만 내려주고, 실제 목록은 Sub 요청에 포함됨.
        # orderMode=1 + orderStat=D 가 상장예정일 기준 최근 공모 행을 앞쪽에 둠 (3은 오래된 데이터가 앞에 옴).
        data = {
            "method": "searchPubofrProgComSub",
            "currentPageSize": "100",
            "pageIndex": "1",
            "orderMode": "1",
            "orderStat": "D",
        }
        results = []
        req_headers = {
            **self.headers,
            "Referer": f"{self.base_url}/listinvstg/pubofrprogcom.do?method=searchPubofrProgComMain",
        }

        try:
            async with httpx.AsyncClient(headers=req_headers, timeout=self.timeout) as client:
                response = await client.post(url, data=data)
                response.raise_for_status()

                soup = BeautifulSoup(response.text, "html.parser")
                table = soup.find("table", class_="list")
                tbody = table.find("tbody") if table else None
                if not table or not tbody:
                    return results

                # 열: 0회사명, 1신고서제출일, 2수요예측, 3청약일정, 4납입일, 5확정공모가, 6공모금액, 7상장예정일, 8주선인
                for row in tbody.find_all("tr"):
                    cols = row.find_all("td")
                    if len(cols) < 9:
                        continue

                    corp_name = cols[0].get_text(strip=True)
                    sub_date_raw = cols[3].get_text(separator=" ", strip=True)
                    ipo_date_raw = cols[7].get_text(strip=True)
                    underwriter_raw = cols[8].get_text(strip=True)
                    underwriter = ", ".join(
                        [f"[{u.strip()}]" for u in underwriter_raw.split(",") if u.strip()]
                    )

                    # 상장일
                    ipo_norm = _first_yyyy_mm_dd(ipo_date_raw)
                    if ipo_norm:
                        results.append(
                            {
                                "date": ipo_norm,
                                "subject": f"[신규상장] {corp_name}",
                                "content": "공모주 신규 상장",
                                "detail": f"상장기업: {corp_name}\n주관사: {underwriter}",
                                "type": "krx",
                                "underwriter": underwriter,
                            }
                        )

                    # 청약 기간 (텍스트 예: 2026-03-19~ 2026-03-20)
                    if "~" in sub_date_raw:
                        found = re.findall(r"\d{4}[.\-]\d{2}[.\-]\d{2}", sub_date_raw)
                        norm = [x.replace(".", "-") for x in found]
                        if len(norm) >= 2:
                            results.append(
                                {
                                    "date": norm[0],
                                    "end_date": norm[1],
                                    "subject": f"[공모청약] {corp_name}",
                                    "content": "공모주 청약 기간",
                                    "detail": f"청약기업: {corp_name}\n청약기간: {sub_date_raw}\n주관사: {underwriter}",
                                    "type": "krx",
                                    "underwriter": underwriter,
                                }
                            )

                print(f"✅ KRX KIND 공모주 일정 파싱 완료: {len(results)}건")
                return results

        except Exception as e:
            print(f"❌ KRX KIND 공모주 파싱 오류: {e}")
            return []

    def save_schedules_to_db(self, db_session, schedules: List[Dict]):
        """
        일정 데이터를 DB에 병합(Upsert)
        같은 날짜, 같은 제목이면 무시하거나 갱신
        """
        try:
            saved_count = 0
            for item in schedules:
                d_raw = item.get("date")
                if isinstance(d_raw, str):
                    start_d = date_cls.fromisoformat(d_raw[:10])
                elif isinstance(d_raw, date_cls):
                    start_d = d_raw
                else:
                    continue
                end_raw = item.get("end_date")
                end_d = None
                if end_raw:
                    end_d = date_cls.fromisoformat(end_raw[:10]) if isinstance(end_raw, str) else end_raw

                existing = db_session.query(Schedule).filter(
                    Schedule.date == start_d,
                    Schedule.subject == item['subject'],
                    Schedule.type == item['type'] # 'krx'
                ).first()

                if not existing:
                    new_sched = Schedule(
                        date=start_d,
                        end_date=end_d,
                        subject=item['subject'],
                        content=item.get('content', ''),
                        detail=item.get('detail', ''),
                        type=item.get('type', 'krx'),
                        underwriter=item.get('underwriter'),
                        show_main_popup=False
                    )
                    db_session.add(new_sched)
                    saved_count += 1
                else:
                    # 필요시 업데이트 로직
                    existing.underwriter = item.get('underwriter', existing.underwriter)
                    existing.detail = item.get('detail', existing.detail)
                    existing.end_date = end_d if end_d is not None else existing.end_date
            
            db_session.commit()
            print(f"✅ KRX KIND DB 적재 완료 (종류: KRX, 신규추가: {saved_count}건)")
        except Exception as e:
            db_session.rollback()
            print(f"❌ KRX KIND DB 적재 중 오류 발생: {e}")


krx_kind_service = KrxKindService()
