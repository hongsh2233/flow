import httpx
import json
import os
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import KrxData, FscStockPrice, FscRisingStock

class KrxApiService:
    """
    한국거래소(KRX) API 서비스
    
    한국거래소 공개 API를 사용하여 코스피, 코스닥 지수 데이터를 조회하고
    데이터베이스에 저장하는 서비스입니다.
    
    주요 메서드:
        - fetch_kospi_index: 코스피 지수 데이터 조회
        - fetch_kosdaq_index: 코스닥 지수 데이터 조회
        - fetch_market_index: 시장 현황 데이터 조회
        - save_krx_data_to_db: 조회한 데이터를 DB에 저장
        - get_krx_data_from_db: DB에서 데이터 조회
    """
    def __init__(self):
        self.base_url = "https://data-dbg.krx.co.kr/svc/apis"
        # 환경 변수에서 API 키 읽기 (없으면 기본값 사용)
        self.api_key = os.getenv("KRX_API_KEY", "73346D637E1B47AA8B653668D4D969288CEAB195")
        self.timeout = 30.0
        # 보안: API 키는 콘솔에 출력하지 않음
        print(f"🔑 KRX API 키 로드 완료")

    def _get_data_from_db(self, db: Session, data_type: str, bas_dd: str) -> Optional[List]:
        """
        DB에서 해당 날짜의 데이터 조회
        
        Args:
            db: SQLAlchemy 데이터베이스 세션
            data_type: 데이터 타입 ('kospi', 'kosdaq', 'market')
            bas_dd: 기준일자 (YYYYMMDD 형식)
        
        Returns:
            List: 지수 데이터 리스트, 데이터가 없으면 None
        """
        krx_data = db.query(KrxData).filter(
            KrxData.data_type == data_type,
            KrxData.bas_dd == bas_dd
        ).first()
        
        if krx_data:
            return json.loads(krx_data.data)
        return None

    def _save_data_to_db(self, db: Session, data_type: str, bas_dd: str, data: List):
        """
        DB에 데이터 저장 (중복 체크 후 저장)
        
        기존 데이터가 있으면 업데이트, 없으면 새로 저장합니다.
        
        Args:
            db: SQLAlchemy 데이터베이스 세션
            data_type: 데이터 타입 ('kospi', 'kosdaq', 'market')
            bas_dd: 기준일자 (YYYYMMDD 형식)
            data: 저장할 지수 데이터 리스트
        """
        # 기존 데이터 확인
        existing = db.query(KrxData).filter(
            KrxData.data_type == data_type,
            KrxData.bas_dd == bas_dd
        ).first()
        
        if existing:
            # 기존 데이터 업데이트
            existing.data = json.dumps(data, ensure_ascii=False)
            db.commit()
            print(f"✅ DB 데이터 업데이트: {data_type} - {bas_dd}")
        else:
            # 새 데이터 저장
            krx_data = KrxData(
                data_type=data_type,
                bas_dd=bas_dd,
                data=json.dumps(data, ensure_ascii=False)
            )
            db.add(krx_data)
            db.commit()
            print(f"✅ DB 데이터 저장: {data_type} - {bas_dd}")

    async def _fetch_krx_data(self, endpoint: str, bas_dd: Optional[str] = None, db: Optional[Session] = None, data_type: Optional[str] = None) -> List:
        """
        한국거래소 API에서 데이터 조회

        DB에 데이터가 있으면 DB에서 조회하고, 없으면 API를 호출하여 데이터를 가져온 후 DB에 저장합니다.
        장 마감 후 데이터 생성 시간을 고려하여 최대 14일까지 역순으로 조회합니다. (7거래일 확보)

        Args:
            endpoint: API 엔드포인트 경로 (예: '/idx/kospi_dd_trd')
            bas_dd: 기준일자 (YYYYMMDD 형식, None이면 오늘 날짜부터 조회)
            db: 데이터베이스 세션 (제공되면 DB 조회/저장 수행)
            data_type: 데이터 타입 ('kospi', 'kosdaq', 'etf')

        Returns:
            List: 지수 데이터 리스트 (OutBlock_1 내부 데이터)
        """
        url = f"{self.base_url}{endpoint}"
        print(f"🔍 API 호출 시작: {url} (data_type: {data_type}, bas_dd: {bas_dd})")

        if bas_dd is None:
            current_date = datetime.now()
            bas_dd_str = current_date.strftime("%Y%m%d")
        else:
            current_date = datetime.strptime(bas_dd, "%Y%m%d")
            bas_dd_str = bas_dd

        # DB에 데이터가 있는지 확인 (db와 data_type이 제공된 경우만)
        if db and data_type:
            db_data = self._get_data_from_db(db, data_type, bas_dd_str)
            if db_data:
                print(f"✅ DB에서 데이터 조회: {data_type} - {bas_dd_str} ({len(db_data)}건)")
                return db_data

        # DB에 없으면 API 호출 (7거래일 확보를 위해 최대 14일까지 시도)
        max_retries = 14
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for day_offset in range(max_retries):
                target_date = current_date - timedelta(days=day_offset)
                target_date_str = target_date.strftime("%Y%m%d")

                params = {
                    "AUTH_KEY": self.api_key,
                    "basDd": target_date_str
                }

                try:
                    print(f"📡 API 요청 시도 ({day_offset + 1}/{max_retries}): {target_date_str}")
                    print(f"   URL: {url}")
                    # 보안: API 키가 포함된 Params는 콘솔에 출력하지 않음
                    print(f"   Params: [AUTH_KEY 포함됨]")
                    response = await client.get(url, params=params)
                    print(f"📥 응답 상태: {response.status_code}")
                    # 보안: 응답 헤더는 콘솔에 출력하지 않음 (민감 정보 포함 가능)

                    # 응답 본문 확인 (출력하지 않음)
                    response_text = response.text
                    # 보안: 응답 본문은 콘솔에 출력하지 않음 (민감 정보 포함 가능)

                    response.raise_for_status()
                    result = response.json()

                    # 응답 구조 디버깅
                    print(f"📦 응답 키: {list(result.keys())}")

                    # 명세서 구조: result["OutBlock_1"]이 리스트여야 함
                    if "OutBlock_1" in result and isinstance(result["OutBlock_1"], list):
                        if len(result["OutBlock_1"]) > 0:
                            data_list = result["OutBlock_1"]
                            print(f"✅ KRX API 데이터 추출 성공 ({endpoint}, {target_date_str}, data_type: {data_type}): {len(data_list)}건")

                            # 첫 번째 데이터 항목의 필드 확인 (디버깅용)
                            if data_list and len(data_list) > 0:
                                print(f"📋 첫 번째 항목 필드: {list(data_list[0].keys())}")
                                print(f"📋 첫 번째 항목 샘플 데이터: {data_list[0]}")

                            # DB에 저장 (db와 data_type이 제공된 경우만)
                            if db and data_type:
                                print(f"💾 DB 저장: data_type={data_type}, bas_dd={target_date_str}")
                                self._save_data_to_db(db, data_type, target_date_str, data_list)

                            return data_list
                        else:
                            print(f"⚠️ {target_date_str} 응답에 OutBlock_1 데이터가 비어있음 (거래일 아님)")
                    else:
                        print(f"⚠️ {target_date_str} 응답에 OutBlock_1 키가 없거나 형식이 다름")
                        if "OutBlock_1" in result:
                            print(f"   OutBlock_1 타입: {type(result['OutBlock_1'])}")
                            print(f"   OutBlock_1 내용: {result['OutBlock_1']}")
                except httpx.HTTPStatusError as e:
                    print(f"❌ HTTP 오류 ({target_date_str}): 상태 코드 {e.response.status_code}")
                    print(f"   오류 응답: {e.response.text[:500]}")
                    continue
                except httpx.RequestError as e:
                    print(f"❌ 요청 오류 ({target_date_str}): {str(e)}")
                    continue
                except Exception as e:
                    print(f"❌ API 호출 오류 ({target_date_str}): {type(e).__name__}: {str(e)}")
                    import traceback
                    print(f"   상세 오류: {traceback.format_exc()}")
                    continue

            print(f"⚠️ 최근 {max_retries}일간 데이터를 찾을 수 없음 (data_type: {data_type})")
            return [] # 데이터가 없으면 빈 리스트 반환

    async def fetch_kospi_index(self, bas_dd: Optional[str] = None, db: Optional[Session] = None) -> List:
        """
        코스피 지수 데이터 조회
        
        KOSPI 시리즈 일별시세정보를 조회합니다.
        
        Args:
            bas_dd: 기준일자 (YYYYMMDD 형식, None이면 오늘 날짜부터 조회)
            db: 데이터베이스 세션 (제공되면 DB 조회/저장 수행)
        
        Returns:
            List: 코스피 지수 데이터 리스트
        """
        return await self._fetch_krx_data("/idx/kospi_dd_trd", bas_dd, db, "kospi")
    
    async def fetch_kosdaq_index(self, bas_dd: Optional[str] = None, db: Optional[Session] = None) -> List:
        """
        코스닥 지수 데이터 조회
        
        KOSDAQ 시리즈 일별시세정보를 조회합니다.
        
        Args:
            bas_dd: 기준일자 (YYYYMMDD 형식, None이면 오늘 날짜부터 조회)
            db: 데이터베이스 세션 (제공되면 DB 조회/저장 수행)
        
        Returns:
            List: 코스닥 지수 데이터 리스트
        """
        return await self._fetch_krx_data("/idx/kosdaq_dd_trd", bas_dd, db, "kosdaq")
    
    async def fetch_market_index(self, bas_dd: Optional[str] = None, db: Optional[Session] = None) -> Dict:
        """
        전체 시장 지수 데이터 조회 (코스피 + 코스닥)

        Args:
            bas_dd: 기준일자 (YYYYMMDD 형식, None이면 오늘 날짜부터 조회)
            db: 데이터베이스 세션 (제공되면 DB 조회/저장 수행)

        Returns:
            Dict: {'kospi': 코스피 데이터, 'kosdaq': 코스닥 데이터}
        """
        kospi_data = await self.fetch_kospi_index(bas_dd, db)
        kosdaq_data = await self.fetch_kosdaq_index(bas_dd, db)
        return {"kospi": kospi_data, "kosdaq": kosdaq_data}

    async def fetch_etf_data(self, bas_dd: Optional[str] = None, db: Optional[Session] = None) -> List:
        """
        ETF 일별매매정보 조회

        ETF(상장지수펀드)의 매매정보를 조회합니다. ('10년01월04일 데이터부터 제공)

        Args:
            bas_dd: 기준일자 (YYYYMMDD 형식, None이면 오늘 날짜부터 조회)
            db: 데이터베이스 세션 (제공되면 DB 조회/저장 수행)

        Returns:
            List: ETF 매매정보 데이터 리스트
        """
        return await self._fetch_krx_data("/etp/etf_bydd_trd", bas_dd, db, "etf")

krx_api_service = KrxApiService()


class FscApiService:
    """금융위원회 API 서비스"""
    def __init__(self):
        self.base_url = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService"
        self.api_key = "4614abeae6a355ee62d9d9ac6ff0799dae33fca08be8939ee0199563ac8e2f61"
        self.timeout = 30.0

    def _get_latest_date_from_db(self, db: Session) -> Optional[str]:
        """
        DB에서 가장 최신 날짜 조회
        
        Args:
            db: SQLAlchemy 데이터베이스 세션
        
        Returns:
            str: 최신 날짜 (YYYYMMDD 형식), 데이터가 없으면 None
        """
        latest = db.query(FscStockPrice.bas_dt).order_by(FscStockPrice.bas_dt.desc()).first()
        if latest:
            return latest[0]
        return None

    def _get_data_from_db(self, db: Session, bas_dt: str) -> Optional[List]:
        """
        DB에서 해당 날짜의 데이터 조회
        
        Args:
            db: SQLAlchemy 데이터베이스 세션
            bas_dt: 기준일자 (YYYYMMDD 형식)
        
        Returns:
            List: 주식시세정보 리스트, 데이터가 없으면 None
        """
        data = db.query(FscStockPrice).filter(FscStockPrice.bas_dt == bas_dt).all()
        if data:
            # 모델을 딕셔너리로 변환
            result = []
            for item in data:
                result.append({
                    'basDt': item.bas_dt,
                    'srtnCd': item.srtn_cd,
                    'isinCd': item.isin_cd,
                    'itmsNm': item.itms_nm,
                    'mrktCtg': item.mrkt_ctg,
                    'clpr': item.clpr,
                    'vs': item.vs,
                    'fltRt': item.flt_rt,
                    'mkp': item.mkp,
                    'hipr': item.hipr,
                    'lopr': item.lopr,
                    'trqu': item.trqu,
                    'trPrc': item.tr_prc,
                    'lstgStCnt': item.lstg_st_cnt,
                    'mrktTotAmt': item.mrkt_tot_amt
                })
            return result
        return None

    def _save_data_to_db(self, db: Session, bas_dt: str, data: List):
        """
        DB에 데이터 저장 (기존 데이터 삭제 후 새로 저장)
        
        Args:
            db: SQLAlchemy 데이터베이스 세션
            bas_dt: 기준일자 (YYYYMMDD 형식)
            data: 저장할 주식시세정보 리스트
        """
        try:
            # 기존 날짜의 데이터 삭제
            db.query(FscStockPrice).filter(FscStockPrice.bas_dt == bas_dt).delete()
            
            # 새 데이터 저장
            for item in data:
                stock_price = FscStockPrice(
                    bas_dt=bas_dt,
                    srtn_cd=item.get('srtnCd', ''),
                    isin_cd=item.get('isinCd'),
                    itms_nm=item.get('itmsNm'),
                    mrkt_ctg=item.get('mrktCtg'),
                    clpr=item.get('clpr'),
                    vs=item.get('vs'),
                    flt_rt=item.get('fltRt'),
                    mkp=item.get('mkp'),
                    hipr=item.get('hipr'),
                    lopr=item.get('lopr'),
                    trqu=item.get('trqu'),
                    tr_prc=item.get('trPrc'),
                    lstg_st_cnt=item.get('lstgStCnt'),
                    mrkt_tot_amt=item.get('mrktTotAmt')
                )
                db.add(stock_price)
            
            db.commit()
            print(f"✅ DB 데이터 저장 완료: {bas_dt} ({len(data)}건)")
        except Exception as e:
            db.rollback()
            print(f"❌ DB 저장 오류: {str(e)}")
            raise

    def _save_rising_data_to_db(self, db: Session, bas_dt: str, data: List):
        """
        상승종목 DB에 데이터 저장 (기존 데이터 삭제 후 새로 저장)
        시가총액 데이터(fsc_stock_price)와 별도 테이블(fsc_rising_stock)에 저장합니다.

        Args:
            db: SQLAlchemy 데이터베이스 세션
            bas_dt: 기준일자 (YYYYMMDD 형식)
            data: 저장할 상승종목 리스트
        """
        try:
            # 기존 날짜의 상승종목 데이터 삭제
            db.query(FscRisingStock).filter(FscRisingStock.bas_dt == bas_dt).delete()

            # 새 데이터 저장
            for item in data:
                rising_stock = FscRisingStock(
                    bas_dt=bas_dt,
                    srtn_cd=item.get('srtnCd', ''),
                    isin_cd=item.get('isinCd'),
                    itms_nm=item.get('itmsNm'),
                    mrkt_ctg=item.get('mrktCtg'),
                    clpr=item.get('clpr'),
                    vs=item.get('vs'),
                    flt_rt=item.get('fltRt'),
                    mkp=item.get('mkp'),
                    hipr=item.get('hipr'),
                    lopr=item.get('lopr'),
                    trqu=item.get('trqu'),
                    tr_prc=item.get('trPrc'),
                    lstg_st_cnt=item.get('lstgStCnt'),
                    mrkt_tot_amt=item.get('mrktTotAmt')
                )
                db.add(rising_stock)

            db.commit()
            print(f"✅ 상승종목 DB 데이터 저장 완료: {bas_dt} ({len(data)}건)")
        except Exception as e:
            db.rollback()
            print(f"❌ 상승종목 DB 저장 오류: {str(e)}")
            raise

    async def fetch_stock_price_info(self, page_no: int = 1, num_of_rows: int = 200, bas_dt: Optional[str] = None, db: Optional[Session] = None) -> tuple[List, Optional[str]]:
        """
        주식시세정보 조회 (장 마감 후 데이터 생성 고려하여 최대 7일까지 역순 조회)
        
        DB에 저장할 때는 코스피 상위 200개 + 코스닥 상위 200개 = 총 최대 400개를 저장합니다.
        """
        url = f"{self.base_url}/getStockPriceInfo"
        
        # 날짜가 없으면 오늘 날짜부터 시작
        if bas_dt is None:
            current_date = datetime.now()
        else:
            current_date = datetime.strptime(bas_dt, "%Y%m%d")
        
        # 최대 7일까지 역순으로 조회 (장 마감 후 데이터 생성 고려)
        max_retries = 7
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for day_offset in range(max_retries):
                target_date = current_date - timedelta(days=day_offset)
                target_date_str = target_date.strftime("%Y%m%d")
                
                # DB에 저장할 때는 더 많은 데이터를 가져온 후 정렬해서 상위 200개만 저장
                api_num_of_rows = 1000 if db else num_of_rows
                
                params = {
                    "serviceKey": self.api_key,
                    "pageNo": page_no,
                    "numOfRows": api_num_of_rows,
                    "resultType": "json",
                    "basDt": target_date_str  # 기준일자
                }
                
                try:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    result = response.json()
                    
                    # 응답 구조 파싱
                    items = []
                    if "response" in result:
                        body = result["response"].get("body", {})
                        if "items" in body:
                            items_obj = body["items"]
                            if "item" in items_obj:
                                item_data = items_obj["item"]
                                if isinstance(item_data, list):
                                    items = item_data
                                else:
                                    items = [item_data]
                    
                    # 데이터가 있으면 반환
                    if len(items) > 0:
                        # 실제 데이터의 기준일자 확인
                        actual_date = target_date_str
                        if items and len(items) > 0:
                            actual_date = items[0].get('basDt', target_date_str)
                        
                        # DB에 저장할 때는 코스피/코스닥 각각 상위 200개씩 저장 (총 최대 400개)
                        if db and actual_date:
                            # 코스피와 코스닥을 분리
                            kospi_items = [item for item in items if item.get('mrktCtg') == 'KOSPI']
                            kosdaq_items = [item for item in items if item.get('mrktCtg') == 'KOSDAQ']
                            
                            # 코스피 시가총액 기준 정렬 및 상위 200개
                            sorted_kospi = sorted(
                                kospi_items,
                                key=lambda x: float(x.get('mrktTotAmt', 0) or 0),
                                reverse=True
                            )[:200]
                            
                            # 코스닥 시가총액 기준 정렬 및 상위 200개
                            sorted_kosdaq = sorted(
                                kosdaq_items,
                                key=lambda x: float(x.get('mrktTotAmt', 0) or 0),
                                reverse=True
                            )[:200]
                            
                            # 두 리스트 합치기
                            top_items = sorted_kospi + sorted_kosdaq
                            
                            print(f"✅ 금융위원회 주식시세정보 조회 성공 ({target_date_str}): {len(items)}건 → 코스피 {len(sorted_kospi)}건 + 코스닥 {len(sorted_kosdaq)}건 = 총 {len(top_items)}건 저장 (실제 데이터 기준일자: {actual_date})")
                            
                            # 기존 데이터 삭제 후 새 데이터 저장 (같은 날짜라도 항상 최신 데이터로 업데이트)
                            self._save_data_to_db(db, actual_date, top_items)
                            print(f"✅ DB 업데이트 완료: {actual_date} (코스피 {len(sorted_kospi)}건 + 코스닥 {len(sorted_kosdaq)}건 = 총 {len(top_items)}건 저장)")
                            
                            # 반환할 때는 전체 데이터 반환 (필터링은 조회 시 수행)
                            return top_items, actual_date
                        else:
                            # DB에 저장하지 않을 때는 원본 데이터 반환 (최대 num_of_rows개)
                            if not db:
                                # 시가총액 기준으로 정렬하고 제한
                                sorted_items = sorted(
                                    items,
                                    key=lambda x: float(x.get('mrktTotAmt', 0) or 0),
                                    reverse=True
                                )
                                items = sorted_items[:num_of_rows]
                            
                            print(f"✅ 금융위원회 주식시세정보 조회 성공 ({target_date_str}): {len(items)}건 (실제 데이터 기준일자: {actual_date})")
                            return items, actual_date
                    else:
                        print(f"⚠️ {target_date_str} 응답에 데이터가 비어있음")
                        
                except Exception as e:
                    print(f"❌ 금융위원회 API 호출 오류 ({target_date_str}): {str(e)}")
                    continue
            
            print(f"⚠️ 최근 {max_retries}일간 데이터를 찾을 수 없음")
            return [], None

    async def fetch_rising_stocks(self, bas_dt: Optional[str] = None, db: Optional[Session] = None, min_flt_rt: float = 10.0, limit: int = 1000) -> tuple[List, Optional[str]]:
        """
        상승종목 조회 (10% 이상 상승 종목만 필터링)
        
        시가총액 데이터를 호출한 후, 10% 이상 상승한 종목만 필터링하여 DB에 저장합니다.
        시가총액 상위 종목과 동일하게 bas_dt=None이면 최신 데이터를 자동으로 찾습니다.
        
        Args:
            bas_dt: 기준일자 (YYYYMMDD 형식, None이면 최신 데이터 자동 조회)
            db: 데이터베이스 세션 (None이면 저장하지 않음)
            min_flt_rt: 최소 등락률 (%) - 기본값 10.0% (10% 이상 상승 종목만)
            limit: 수집할 최대 종목 수 (기본값 1000, 실제로는 필터링된 결과만 저장)
        
        Returns:
            tuple: (상승종목 리스트, 실제 데이터 기준일자)
        """
        url = f"{self.base_url}/getStockPriceInfo"
        
        # 날짜가 없으면 오늘 날짜부터 시작 (시가총액 상위 종목과 동일)
        if bas_dt is None:
            current_date = datetime.now()
        else:
            current_date = datetime.strptime(bas_dt, "%Y%m%d")
        
        # 최대 7일까지 역순으로 조회 (장 마감 후 데이터 생성 고려)
        max_retries = 7
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for day_offset in range(max_retries):
                target_date = current_date - timedelta(days=day_offset)
                target_date_str = target_date.strftime("%Y%m%d")
                
                # 시가총액 데이터처럼 많은 데이터를 가져옴 (1000개)
                api_num_of_rows = 1000
                
                params = {
                    "serviceKey": self.api_key,
                    "pageNo": 1,
                    "numOfRows": api_num_of_rows,
                    "resultType": "json",
                    "basDt": target_date_str  # 기준일자
                }
                
                try:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    result = response.json()
                    
                    # 응답 구조 파싱
                    items = []
                    if "response" in result:
                        body = result["response"].get("body", {})
                        if "items" in body:
                            items_obj = body["items"]
                            if "item" in items_obj:
                                item_data = items_obj["item"]
                                if isinstance(item_data, list):
                                    items = item_data
                                else:
                                    items = [item_data]
                    
                    # 데이터가 있으면 코스피/코스닥 구분하여 10% 이상 상승 종목만 필터링
                    if len(items) > 0:
                        # 실제 데이터의 기준일자 확인
                        actual_date = target_date_str
                        if items and len(items) > 0:
                            actual_date = items[0].get('basDt', target_date_str)
                        
                        # 코스피와 코스닥을 분리
                        kospi_items = [item for item in items if item.get('mrktCtg') == 'KOSPI']
                        kosdaq_items = [item for item in items if item.get('mrktCtg') == 'KOSDAQ']
                        
                        # 코스피 10% 이상 상승 종목만 필터링
                        kospi_rising = []
                        for item in kospi_items:
                            flt_rt = float(item.get('fltRt', 0) or 0)
                            if flt_rt >= min_flt_rt:  # 10% 이상 상승
                                kospi_rising.append(item)
                        
                        # 코스닥 10% 이상 상승 종목만 필터링
                        kosdaq_rising = []
                        for item in kosdaq_items:
                            flt_rt = float(item.get('fltRt', 0) or 0)
                            if flt_rt >= min_flt_rt:  # 10% 이상 상승
                                kosdaq_rising.append(item)
                        
                        # 코스피 등락률 기준으로 정렬 (내림차순)
                        sorted_kospi = sorted(
                            kospi_rising,
                            key=lambda x: float(x.get('fltRt', 0) or 0),
                            reverse=True
                        )[:limit]
                        
                        # 코스닥 등락률 기준으로 정렬 (내림차순)
                        sorted_kosdaq = sorted(
                            kosdaq_rising,
                            key=lambda x: float(x.get('fltRt', 0) or 0),
                            reverse=True
                        )[:limit]
                        
                        # 두 리스트 합치기
                        top_rising_items = sorted_kospi + sorted_kosdaq
                        
                        print(f"✅ 상승종목 조회 성공 ({target_date_str}): 전체 {len(items)}건 → 코스피 {min_flt_rt}% 이상 상승 {len(kospi_rising)}건 + 코스닥 {min_flt_rt}% 이상 상승 {len(kosdaq_rising)}건 = 총 {len(top_rising_items)}건 저장 (실제 데이터 기준일자: {actual_date})")
                        
                        # DB에 저장할 때는 코스피/코스닥 각각 10% 이상 상승 종목 저장
                        if db and actual_date:
                            # 별도 테이블(fsc_rising_stock)에 저장 (시가총액 데이터를 덮어쓰지 않음)
                            self._save_rising_data_to_db(db, actual_date, top_rising_items)
                            print(f"✅ 상승종목 DB 업데이트 완료: {actual_date} (코스피 {len(sorted_kospi)}건 + 코스닥 {len(sorted_kosdaq)}건 = 총 {len(top_rising_items)}건 저장)")

                            # 반환할 때는 필터링된 상승 종목만 반환
                            return top_rising_items, actual_date
                        else:
                            # DB에 저장하지 않을 때는 필터링된 데이터 반환
                            print(f"✅ 상승종목 조회 성공 ({target_date_str}): 코스피 {len(sorted_kospi)}건 + 코스닥 {len(sorted_kosdaq)}건 = 총 {len(top_rising_items)}건 (실제 데이터 기준일자: {actual_date})")
                            return top_rising_items, actual_date
                    else:
                        print(f"⚠️ {target_date_str} 응답에 데이터가 비어있음")
                        
                except Exception as e:
                    print(f"❌ 금융위원회 API 호출 오류 ({target_date_str}): {str(e)}")
                    continue
            
            print(f"⚠️ 최근 {max_retries}일간 데이터를 찾을 수 없음")
            return [], None

    async def fetch_disclosure_info(self, disclosure_type: str, page_no: int = 1, num_of_rows: int = 100, bas_dt: Optional[str] = None) -> tuple[List, Optional[str]]:
        """
        공시정보 조회 (5가지 타입)
        
        금융위원회 API에서 공시정보를 조회합니다.
        장 마감 후 데이터 생성 시간을 고려하여 최대 7일까지 역순으로 조회합니다.
        
        Args:
            disclosure_type: 공시정보 타입
                - 'dividend': 배당공시정보조회
                - 'paid_increase': 유상증자결정공시정보조회
                - 'bonus': 무상증자결정공시정보조회
                - 'paid_bonus': 유무상증자결정공시정보조회
                - 'shareholders': 주주총회소집공고공시정보조회
            page_no: 페이지 번호 (기본값: 1)
            num_of_rows: 페이지당 항목 수 (기본값: 100)
            bas_dt: 기준일자 (YYYYMMDD 형식, None이면 오늘 날짜부터 조회)
        
        Returns:
            tuple: (공시정보 리스트, 실제 데이터 기준일자)
        """
        endpoint_map = {
            "dividend": "GetDiviDiscInfo_V2",  # 배당공시정보조회
            "paid_increase": "getCapiIncrWithConsDiscInfo_V2",  # 유상증자결정공시정보조회
            "bonus": "getBonuIssuDiscInfo_V2",  # 무상증자결정공시정보조회
            "paid_bonus": "getCapiIncrWithConsBonuIssuDiscInfo_V2",  # 유무상증자결정공시정보조회
            "shareholders": "getGeneMeetStocPublNotiDiscInfo_V2"  # 주주총회소집공고공시정보조회
        }
        
        if disclosure_type not in endpoint_map:
            return [], None
        
        url = f"http://apis.data.go.kr/1160100/service/GetDiscInfoService_V2/{endpoint_map[disclosure_type]}"
        
        # 날짜가 없으면 오늘 날짜부터 시작
        if bas_dt is None:
            current_date = datetime.now()
        else:
            current_date = datetime.strptime(bas_dt, "%Y%m%d")
        
        # 최대 7일까지 역순으로 조회
        max_retries = 7
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for day_offset in range(max_retries):
                target_date = current_date - timedelta(days=day_offset)
                target_date_str = target_date.strftime("%Y%m%d")
                
                params = {
                    "serviceKey": self.api_key,
                    "pageNo": page_no,
                    "numOfRows": num_of_rows,
                    "resultType": "json",
                    "basDt": target_date_str
                }
                
                try:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    result = response.json()
                    
                    # 응답 구조 파싱
                    items = []
                    if "response" in result:
                        body = result["response"].get("body", {})
                        if "items" in body:
                            items_obj = body["items"]
                            if "item" in items_obj:
                                item_data = items_obj["item"]
                                if isinstance(item_data, list):
                                    items = item_data
                                else:
                                    items = [item_data]
                    
                    # 데이터가 있으면 반환
                    if len(items) > 0:
                        actual_date = items[0].get('basDt', target_date_str)
                        print(f"✅ 공시정보 조회 성공 ({disclosure_type}, {target_date_str}): {len(items)}건")
                        return items, actual_date
                    else:
                        print(f"⚠️ {target_date_str} 응답에 데이터가 비어있음")
                        
                except Exception as e:
                    print(f"❌ 공시정보 API 호출 오류 ({disclosure_type}, {target_date_str}): {str(e)}")
                    continue
            
            print(f"⚠️ 최근 {max_retries}일간 데이터를 찾을 수 없음")
            return [], None

    async def fetch_righ_exer_reas_sche(
        self,
        bas_dt: Optional[str] = None,
        issu_cmpy_ksd_cust_no: Optional[str] = None,
        stck_issu_cmpy_nm: Optional[str] = None,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> tuple[List, Optional[int]]:
        """
        권리행사사유별일정조회 (API-OA-20.1)

        기준일자, 발행회사한국예탁결제원고객번호, 주식발행회사명을 통해
        권리행사시작일자, 권리행사종료일자, 주식결산월일, 명부폐쇄시작일자, 명부폐쇄종료일자 등을 조회합니다.

        Args:
            bas_dt: 기준일자 (YYYYMMDD 형식, 옵션)
            issu_cmpy_ksd_cust_no: 발행회사한국예탁결제원고객번호 (옵션)
            stck_issu_cmpy_nm: 주식발행회사명 (옵션)
            page_no: 페이지 번호
            num_of_rows: 페이지당 항목 수

        Returns:
            tuple: (권리행사일정 리스트, totalCount 또는 None)
        """
        url = "http://apis.data.go.kr/1160100/service/GetStocRighScheService/getRighExerReasSche"

        params = {
            "serviceKey": self.api_key,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "resultType": "json",
        }
        if bas_dt:
            params["basDt"] = bas_dt
        if issu_cmpy_ksd_cust_no:
            params["issuCmpyKsdCustNo"] = issu_cmpy_ksd_cust_no
        if stck_issu_cmpy_nm:
            params["stckIssuCmpyNm"] = stck_issu_cmpy_nm

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                result = response.json()

                items = []
                total_count = None
                if "response" in result:
                    body = result["response"].get("body", {})
                    total_count = body.get("totalCount")
                    if "items" in body:
                        items_obj = body["items"]
                        if "item" in items_obj:
                            item_data = items_obj["item"]
                            items = item_data if isinstance(item_data, list) else [item_data]

                if total_count is not None and isinstance(total_count, str):
                    total_count = int(total_count) if total_count.isdigit() else None
                print(f"✅ 권리행사사유별일정조회 성공: {len(items)}건 (totalCount: {total_count})")
                return items, total_count
        except Exception as e:
            print(f"❌ 권리행사사유별일정조회 API 오류: {str(e)}")
            return [], None

    _FINA_STAT_BASE = "http://apis.data.go.kr/1160100/service/GetFinaStatInfoService_V2"

    async def _fetch_fina_stat_one(
        self, endpoint: str, crno: str, biz_year: str, page_no: int = 1, num_of_rows: int = 500
    ) -> tuple[List, Optional[int]]:
        """GetFinaStatInfoService_V2 단일 오퍼레이션 조회 (법인등록번호, 사업연도)."""
        url = f"{self._FINA_STAT_BASE}/{endpoint}"
        params = {
            "serviceKey": self.api_key,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "resultType": "json",
            "crno": crno.strip(),
            "bizYear": biz_year.strip(),
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                result = response.json()
            items = []
            total_count = None
            if "response" in result:
                body = result["response"].get("body", {})
                total_count = body.get("totalCount")
                if "items" in body and body["items"]:
                    item_data = body["items"].get("item")
                    if item_data is None:
                        pass
                    elif isinstance(item_data, list):
                        items = item_data
                    else:
                        items = [item_data]
            if total_count is not None and isinstance(total_count, str) and total_count.isdigit():
                total_count = int(total_count)
            return items, total_count
        except Exception as e:
            print(f"❌ GetFinaStatInfoService_V2/{endpoint} 오류: {str(e)}")
            return [], None

    async def fetch_summ_fina_stat_v2(self, crno: str, biz_year: str) -> tuple[List, Optional[int]]:
        """요약재무제표조회 getSummFinaStat_V2"""
        return await self._fetch_fina_stat_one("getSummFinaStat_V2", crno, biz_year)

    async def fetch_bs_v2(self, crno: str, biz_year: str) -> tuple[List, Optional[int]]:
        """재무상태표조회 getBs_V2"""
        return await self._fetch_fina_stat_one("getBs_V2", crno, biz_year)

    async def fetch_inco_stat_v2(self, crno: str, biz_year: str) -> tuple[List, Optional[int]]:
        """손익계산서조회 getIncoStat_V2"""
        return await self._fetch_fina_stat_one("getIncoStat_V2", crno, biz_year)

    async def fetch_corp_outline(self) -> tuple[Optional[List], int]:
        """
        기업개요 목록 조회

        금융위원회 API에서 기업개요정보 목록을 조회합니다.
        최대 500개까지 조회합니다.

        Returns:
            tuple: (기업개요정보 리스트 (최대 500개), 전체 데이터 개수)
        """
        url = "http://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2"

        params = {
            "serviceKey": self.api_key,
            "pageNo": 1,
            "numOfRows": 500,  # 최대 500개
            "resultType": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                result = response.json()

                # 응답 구조 파싱
                items = []
                total_count = 0
                if "response" in result:
                    body = result["response"].get("body", {})
                    total_count = body.get("totalCount", 0)  # 전체 데이터 개수
                    if "items" in body:
                        items_obj = body["items"]
                        if "item" in items_obj:
                            item_data = items_obj["item"]
                            if isinstance(item_data, list):
                                items = item_data
                            else:
                                items = [item_data]

                if len(items) > 0:
                    print(f"✅ 기업개요 목록 조회 성공: {len(items)}건 (전체: {total_count}건)")
                    
                    # 디버깅: 첫 번째 아이템의 필드 확인
                    if items:
                        first_item = items[0]
                        print(f"=== 첫 번째 기업 데이터 필드 확인 ===")
                        print(f"모든 필드: {list(first_item.keys())}")
                        print(f"법인등록번호(jurirNo): {first_item.get('jurirNo', '없음')}")
                        print(f"사업자등록번호(bizrNo): {first_item.get('bizrNo', '없음')}")
                        print(f"법인명(corpNm): {first_item.get('corpNm', '없음')}")
                        
                        # 법인번호가 있는 아이템 개수 확인
                        items_with_jurir = [item for item in items if item.get('jurirNo')]
                        items_with_bizr = [item for item in items if item.get('bizrNo')]
                        print(f"법인등록번호가 있는 항목: {len(items_with_jurir)}개")
                        print(f"사업자등록번호가 있는 항목: {len(items_with_bizr)}개")
                    
                    return items[:500], total_count  # 최대 500개로 제한
                else:
                    print(f"⚠️ 기업개요 데이터가 비어있음")
                    return [], 0

        except Exception as e:
            print(f"❌ 기업개요 API 호출 오류: {str(e)}")
            raise

    async def fetch_financial_statement(self, fs_type: str) -> tuple[Optional[List], int]:
        """
        재무제표 목록 조회

        금융위원회 API에서 재무제표정보 목록을 조회합니다.
        최대 500개까지 조회합니다.

        Args:
            fs_type: 재무제표 유형
                - 'BS': 재무상태표
                - 'IS': 손익계산서
                - 'CF': 현금흐름표

        Returns:
            tuple: (재무제표정보 리스트 (최대 500개), 전체 데이터 개수)
        """
        # 재무제표 유형별 엔드포인트 매핑
        endpoint_map = {
            "BS": "getFinaStatInfo_V2",  # 재무상태표
            "IS": "getFinaStatInfo_V2",  # 손익계산서
            "CF": "getFinaStatInfo_V2"   # 현금흐름표
        }

        if fs_type not in endpoint_map:
            print(f"❌ 잘못된 재무제표 유형: {fs_type}")
            return [], 0

        url = f"http://apis.data.go.kr/1160100/service/GetFinaStatInfoService_V2/{endpoint_map[fs_type]}"

        params = {
            "serviceKey": self.api_key,
            "pageNo": 1,
            "numOfRows": 500,  # 최대 500개
            "resultType": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                result = response.json()

                # 응답 구조 파싱
                items = []
                total_count = 0
                if "response" in result:
                    body = result["response"].get("body", {})
                    total_count = body.get("totalCount", 0)  # 전체 데이터 개수
                    if "items" in body:
                        items_obj = body["items"]
                        if "item" in items_obj:
                            item_data = items_obj["item"]
                            if isinstance(item_data, list):
                                items = item_data
                            else:
                                items = [item_data]

                if len(items) > 0:
                    print(f"✅ 재무제표 목록 조회 성공 ({fs_type}): {len(items)}건 (전체: {total_count}건)")
                    return items[:500], total_count  # 최대 500개로 제한
                else:
                    print(f"⚠️ 재무제표 데이터가 비어있음 ({fs_type})")
                    return [], 0

        except Exception as e:
            print(f"❌ 재무제표 API 호출 오류 ({fs_type}): {str(e)}")
            raise

fsc_api_service = FscApiService()

