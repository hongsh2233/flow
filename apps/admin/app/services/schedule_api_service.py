"""
일정 관련 외부 API 호출을 담당하는 서비스 모듈
공공데이터포털 특일 정보제공 서비스를 사용하여 공휴일 정보를 가져옵니다.
"""
import httpx
import pytz
import xml.etree.ElementTree as ET
from urllib.parse import quote
from typing import List, Dict
from datetime import datetime, date
from app.config import DATA_GO_KR_API_KEY


class ScheduleApiService:
    """일정 관련 외부 API 호출 서비스"""
    
    def __init__(self):
        self.api_base_url = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService"
        self.timeout = 30.0
    
    async def fetch_schedules_from_api(self, year: int = None) -> List[Dict]:
        """
        공공데이터포털 API에서 공휴일 정보를 가져옵니다.
        
        Args:
            year: 조회할 연도 (None이면 현재 연도와 다음 연도)
        
        Returns:
            List[Dict]: 일정 데이터 리스트 (date, subject, content, type 포함)
        """
        # API 키 확인 (None, 빈 문자열, 공백만 있는 경우 체크)
        if not DATA_GO_KR_API_KEY or not DATA_GO_KR_API_KEY.strip():
            print("공공데이터포털 API 키가 설정되지 않았습니다.")
            # 보안: API 키 값은 콘솔에 출력하지 않음
            print(".env 파일에 DATA_GO_KR_API_KEY를 설정하고 서버를 재시작해주세요.")
            return []
        
        # API 키 앞뒤 공백 제거
        api_key = DATA_GO_KR_API_KEY.strip()
        print(f"공공데이터포털 API 호출 시작 (API 키 길이: {len(api_key)}자)")
        
        if year is None:
            current_year = datetime.now(pytz.timezone("Asia/Seoul")).year
            years = [current_year, current_year + 1]
        else:
            years = [year]
        
        all_schedules = []
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for sol_year in years:
                    # 공휴일 정보 조회 API 호출
                    # ServiceKey는 인코딩된 버전과 원본 버전 모두 시도
                    url = f"{self.api_base_url}/getRestDeInfo"
                    
                    # API 키 앞뒤 공백 제거
                    api_key = DATA_GO_KR_API_KEY.strip()
                    
                    # 먼저 인코딩된 버전 시도
                    service_key_encoded = quote(api_key, safe='')
                    params_encoded = {
                        "ServiceKey": service_key_encoded,
                        "solYear": str(sol_year),
                        "numOfRows": 100
                    }
                    
                    # 원본 버전도 준비
                    params_original = {
                        "ServiceKey": api_key,
                        "solYear": str(sol_year),
                        "numOfRows": 100
                    }
                    
                    response = None
                    response_text = None
                    
                    # 인코딩된 버전 먼저 시도
                    try:
                        print(f"API 호출 시도 (인코딩된 키): {sol_year}년")
                        response = await client.get(url, params=params_encoded)
                        response.raise_for_status()
                        response_text = response.text
                    except Exception as e1:
                        print(f"인코딩된 키로 호출 실패: {e1}")
                        # 원본 버전 시도
                        try:
                            print(f"API 호출 시도 (원본 키): {sol_year}년")
                            response = await client.get(url, params=params_original)
                            response.raise_for_status()
                            response_text = response.text
                        except Exception as e2:
                            print(f"원본 키로 호출도 실패: {e2}")
                            raise e2
                    
                    try:
                        # 응답 텍스트 확인 (디버깅용)
                        if not response_text:
                            print(f"공공데이터포털 API 응답이 비어있습니다 ({sol_year}년)")
                            continue
                        
                        # XML 응답 파싱
                        try:
                            root = ET.fromstring(response_text)
                        except ET.ParseError as parse_err:
                            print(f"XML 파싱 실패 ({sol_year}년): {parse_err}")
                            print(f"응답 내용 (처음 500자): {response_text[:500]}")
                            continue
                        
                        # 네임스페이스 처리
                        namespaces = {
                            'ns': 'http://www.data.go.kr'
                        }
                        
                        # 응답 코드 확인 (네임스페이스 고려)
                        result_code = root.find(".//resultCode") or root.find(".//ns:resultCode", namespaces)
                        if result_code is not None and result_code.text and result_code.text != "00":
                            result_msg = root.find(".//resultMsg") or root.find(".//ns:resultMsg", namespaces)
                            error_msg = result_msg.text if result_msg is not None and result_msg.text else "알 수 없는 오류"
                            print(f"공공데이터포털 API 오류 ({sol_year}년): {error_msg}")
                            print(f"응답 코드: {result_code.text}")
                            continue
                        
                        # items 태그 찾기 (네임스페이스 고려)
                        items = root.findall(".//item") or root.findall(".//ns:item", namespaces)
                        
                        if not items:
                            print(f"공휴일 데이터가 없습니다 ({sol_year}년)")
                            # 전체 응답 구조 확인
                            print(f"응답 구조 확인: {[elem.tag for elem in root.iter()][:20]}")
                            continue
                        
                        for item in items:
                            try:
                                # 날짜 정보 파싱 (locdate: YYYYMMDD 형식)
                                locdate_str = item.find("locdate")
                                if locdate_str is None or locdate_str.text is None:
                                    continue
                                
                                date_str = locdate_str.text
                                # YYYYMMDD 형식을 YYYY-MM-DD로 변환
                                if len(date_str) == 8:
                                    formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                                else:
                                    continue
                                
                                # 공휴일 이름
                                date_name = item.find("dateName")
                                holiday_name = date_name.text if date_name is not None and date_name.text else "공휴일"
                                
                                # 공휴일 구분 (Y: 윤년, N: 평년)
                                is_holiday = item.find("isHoliday")
                                is_holiday_val = is_holiday.text if is_holiday is not None else "Y"
                                
                                all_schedules.append({
                                    "date": formatted_date,
                                    "subject": holiday_name,
                                    "content": f"공휴일 ({sol_year}년)",
                                    "type": "api"
                                })
                            except Exception as e:
                                print(f"공휴일 항목 파싱 실패: {e}")
                                continue
                    
                    except httpx.HTTPError as e:
                        print(f"공공데이터포털 API 호출 실패 ({sol_year}년): {e}")
                        continue
                    except ET.ParseError as e:
                        print(f"XML 파싱 실패 ({sol_year}년): {e}")
                        continue
                    except Exception as e:
                        print(f"예상치 못한 오류 ({sol_year}년): {e}")
                        continue
        
        except Exception as e:
            print(f"공휴일 정보 조회 중 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            return []
        
        print(f"총 {len(all_schedules)}개의 공휴일 정보를 가져왔습니다.")
        return all_schedules


# 싱글톤 인스턴스
schedule_api_service = ScheduleApiService()

