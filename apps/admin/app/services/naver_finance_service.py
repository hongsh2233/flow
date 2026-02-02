"""
네이버 증권 데이터 스크래핑 서비스

네이버 증권에서 거래량 상위, 거래대금 상위, 검색 상위 데이터를 수집합니다.
"""
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import pytz
import re

from app.models import NaverStockRanking


class NaverFinanceService:
    """
    네이버 증권 스크래핑 서비스
    
    거래량 상위, 거래대금 상위, 검색 상위 데이터를 수집합니다.
    """
    
    def __init__(self):
        self.base_url = "https://finance.naver.com"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        }
        self.timeout = 30.0
    
    def _parse_number(self, text: str) -> str:
        """숫자 문자열에서 쉼표 제거 및 정리"""
        if not text:
            return ""
        return text.replace(',', '').strip()
    
    def _parse_change_percent(self, text: str) -> str:
        """등락률 문자열에서 '상승', '하락' 텍스트를 +, - 기호로 변환"""
        if not text:
            return ""
        
        text = text.strip()
        
        # "상승" 텍스트가 포함된 경우
        if '상승' in text:
            # 숫자만 추출
            num_match = re.search(r'([\d.]+)', text)
            if num_match:
                num_value = num_match.group(1)
                has_percent = '%' in text
                return f"+{num_value}{'%' if has_percent else ''}"
        
        # "하락" 텍스트가 포함된 경우
        if '하락' in text:
            # 숫자만 추출
            num_match = re.search(r'([\d.]+)', text)
            if num_match:
                num_value = num_match.group(1)
                has_percent = '%' in text
                return f"-{num_value}{'%' if has_percent else ''}"
        
        # 이미 +, - 기호가 있으면 그대로 반환
        if text.startswith('+') or text.startswith('-'):
            return text
        
        # 부호가 없는 경우 숫자 값으로 판단하여 +, - 추가
        num_match = re.search(r'([\d.]+)', text)
        if num_match:
            num_value = float(num_match.group(1))
            has_percent = '%' in text
            sign = '+' if num_value > 0 else '-' if num_value < 0 else ''
            return f"{sign}{abs(num_value)}{'%' if has_percent else ''}"
        
        return text
    
    def _parse_stock_code_from_href(self, href: str) -> Optional[str]:
        """종목 상세 페이지 URL에서 종목 코드 추출"""
        if not href:
            return None
        match = re.search(r'code=(\d{6})', href)
        return match.group(1) if match else None
    
    async def fetch_volume_ranking(self, market_type: str = 'all', limit: int = 50) -> List[Dict]:
        """
        거래량 상위 종목 조회
        
        Args:
            market_type: 'kospi' (코스피), 'kosdaq' (코스닥), 'all' (전체)
            limit: 조회할 종목 수 (기본값: 50)
        
        Returns:
            List[Dict]: 거래량 상위 종목 리스트
        """
        try:
            # 시장 타입에 따른 sosok 파라미터 설정
            sosok_map = {
                'kospi': '0',
                'kosdaq': '1',
                'all': ''
            }
            sosok = sosok_map.get(market_type, '')
            
            # 거래량 상위 URL (정렬 기준: 거래량)
            url = f"{self.base_url}/sise/sise_market_sum.naver"
            params = {
                'sosok': sosok,
                'page': 1,
                'fieldName': 'volume',  # 거래량 기준 정렬
            }
            
            async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                results = []
                
                # 테이블 찾기
                table = soup.find('table', class_='type_2')
                if not table:
                    print(f"⚠️ 거래량 상위 테이블을 찾을 수 없습니다.")
                    return results
                
                # 테이블 행 파싱 (헤더 제외)
                rows = table.find_all('tr')[2:]  # 첫 2줄은 헤더
                
                for idx, row in enumerate(rows[:limit]):
                    cells = row.find_all('td')
                    if len(cells) < 10:
                        continue
                    
                    try:
                        # 종목명과 코드 추출
                        name_cell = cells[1]
                        stock_name = name_cell.get_text(strip=True)
                        stock_link = name_cell.find('a')
                        stock_code = None
                        if stock_link:
                            href = stock_link.get('href', '')
                            stock_code = self._parse_stock_code_from_href(href)
                        
                        if not stock_code or not stock_name:
                            continue
                        
                        # 현재가, 전일대비, 등락률, 거래량, 거래대금 추출
                        current_price = self._parse_number(cells[2].get_text(strip=True))
                        change = cells[3].get_text(strip=True)
                        change_percent = self._parse_change_percent(cells[4].get_text(strip=True))
                        volume = self._parse_number(cells[6].get_text(strip=True))
                        amount = self._parse_number(cells[7].get_text(strip=True))
                        
                        results.append({
                            'rank': idx + 1,
                            'stock_code': stock_code,
                            'stock_name': stock_name,
                            'current_price': current_price,
                            'change': change,
                            'change_percent': change_percent,
                            'volume': volume,
                            'amount': amount,
                        })
                    except Exception as e:
                        print(f"⚠️ 행 파싱 오류 (거래량 상위): {e}")
                        continue
                
                print(f"✅ 거래량 상위 데이터 수집 완료: {len(results)}건")
                return results
                
        except Exception as e:
            print(f"❌ 거래량 상위 데이터 수집 오류: {e}")
            return []
    
    async def fetch_amount_ranking(self, market_type: str = 'all', limit: int = 50) -> List[Dict]:
        """
        거래대금 상위 종목 조회
        
        Args:
            market_type: 'kospi' (코스피), 'kosdaq' (코스닥), 'all' (전체)
            limit: 조회할 종목 수 (기본값: 50)
        
        Returns:
            List[Dict]: 거래대금 상위 종목 리스트
        """
        try:
            # 시장 타입에 따른 sosok 파라미터 설정
            sosok_map = {
                'kospi': '0',
                'kosdaq': '1',
                'all': ''
            }
            sosok = sosok_map.get(market_type, '')
            
            # 거래대금 상위 URL (정렬 기준: 거래대금)
            url = f"{self.base_url}/sise/sise_market_sum.naver"
            params = {
                'sosok': sosok,
                'page': 1,
                'fieldName': 'amount',  # 거래대금 기준 정렬
            }
            
            async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                results = []
                
                # 테이블 찾기
                table = soup.find('table', class_='type_2')
                if not table:
                    print(f"⚠️ 거래대금 상위 테이블을 찾을 수 없습니다.")
                    return results
                
                # 테이블 행 파싱 (헤더 제외)
                rows = table.find_all('tr')[2:]  # 첫 2줄은 헤더
                
                for idx, row in enumerate(rows[:limit]):
                    cells = row.find_all('td')
                    if len(cells) < 10:
                        continue
                    
                    try:
                        # 종목명과 코드 추출
                        name_cell = cells[1]
                        stock_name = name_cell.get_text(strip=True)
                        stock_link = name_cell.find('a')
                        stock_code = None
                        if stock_link:
                            href = stock_link.get('href', '')
                            stock_code = self._parse_stock_code_from_href(href)
                        
                        if not stock_code or not stock_name:
                            continue
                        
                        # 현재가, 전일대비, 등락률, 거래량, 거래대금 추출
                        current_price = self._parse_number(cells[2].get_text(strip=True))
                        change = cells[3].get_text(strip=True)
                        change_percent = self._parse_change_percent(cells[4].get_text(strip=True))
                        volume = self._parse_number(cells[6].get_text(strip=True))
                        amount = self._parse_number(cells[7].get_text(strip=True))
                        
                        results.append({
                            'rank': idx + 1,
                            'stock_code': stock_code,
                            'stock_name': stock_name,
                            'current_price': current_price,
                            'change': change,
                            'change_percent': change_percent,
                            'volume': volume,
                            'amount': amount,
                        })
                    except Exception as e:
                        print(f"⚠️ 행 파싱 오류 (거래대금 상위): {e}")
                        continue
                
                print(f"✅ 거래대금 상위 데이터 수집 완료: {len(results)}건")
                return results
                
        except Exception as e:
            print(f"❌ 거래대금 상위 데이터 수집 오류: {e}")
            return []
    
    async def fetch_search_ranking(self, limit: int = 50) -> List[Dict]:
        """
        검색 상위 종목 조회
        
        Args:
            limit: 조회할 종목 수 (기본값: 50)
        
        Returns:
            List[Dict]: 검색 상위 종목 리스트
        """
        try:
            # 검색 상위 URL
            url = f"{self.base_url}/sise/lastsearch2.naver"
            
            async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                results = []
                
                # 테이블 찾기
                table = soup.find('table', class_='type_5')
                if not table:
                    print(f"⚠️ 검색 상위 테이블을 찾을 수 없습니다.")
                    return results
                
                # 테이블 행 파싱 (헤더 제외)
                rows = table.find_all('tr')[1:]  # 첫 줄은 헤더
                
                for idx, row in enumerate(rows[:limit]):
                    cells = row.find_all('td')
                    # 컬럼: 순위(0), 종목명(1), 검색비중(2), 현재가(3), 전일대비(4), 등락률(5), ...
                    if len(cells) < 6:
                        continue
                    
                    try:
                        # 순위 추출
                        rank_text = cells[0].get_text(strip=True)
                        rank = int(rank_text) if rank_text.isdigit() else idx + 1
                        
                        # 종목명과 코드 추출
                        name_cell = cells[1]
                        stock_name = name_cell.get_text(strip=True)
                        stock_link = name_cell.find('a')
                        stock_code = None
                        if stock_link:
                            href = stock_link.get('href', '')
                            stock_code = self._parse_stock_code_from_href(href)
                        
                        if not stock_code or not stock_name:
                            continue
                        
                        # 현재가(3), 전일대비(4), 등락률(5) 추출 (2번 컬럼은 검색비중)
                        current_price = self._parse_number(cells[3].get_text(strip=True))
                        change = cells[4].get_text(strip=True)
                        change_percent = self._parse_change_percent(cells[5].get_text(strip=True))
                        
                        results.append({
                            'rank': rank,
                            'stock_code': stock_code,
                            'stock_name': stock_name,
                            'current_price': current_price,
                            'change': change,
                            'change_percent': change_percent,
                            'volume': '',  # 검색 상위에는 거래량 정보가 없을 수 있음
                            'amount': '',  # 검색 상위에는 거래대금 정보가 없을 수 있음
                        })
                    except Exception as e:
                        print(f"⚠️ 행 파싱 오류 (검색 상위): {e}")
                        continue
                
                print(f"✅ 검색 상위 데이터 수집 완료: {len(results)}건")
                return results
                
        except Exception as e:
            print(f"❌ 검색 상위 데이터 수집 오류: {e}")
            return []
    
    def save_ranking_to_db(
        self,
        db: Session,
        ranking_type: str,
        market_type: str,
        data: List[Dict],
        collected_time: str
    ):
        """
        랭킹 데이터를 데이터베이스에 저장
        
        새로운 데이터를 저장하기 전에 같은 시간대의 기존 데이터를 삭제합니다.
        
        Args:
            db: 데이터베이스 세션
            ranking_type: 'volume', 'amount', 'search'
            market_type: 'kospi', 'kosdaq', 'all'
            data: 랭킹 데이터 리스트
            collected_time: 수집 시간대 ('11:00', '16:00', '21:00')
        """
        try:
            kst = pytz.timezone('Asia/Seoul')
            collected_at = datetime.now(kst)
            
            # 같은 시간대의 기존 데이터 삭제
            deleted_count = db.query(NaverStockRanking).filter(
                NaverStockRanking.ranking_type == ranking_type,
                NaverStockRanking.market_type == market_type,
                NaverStockRanking.collected_time == collected_time,
            ).delete()
            
            if deleted_count > 0:
                print(f"🗑️ 기존 데이터 삭제: {deleted_count}건 ({ranking_type}, {market_type}, {collected_time})")
            
            # 새 데이터 저장
            for item in data:
                new_ranking = NaverStockRanking(
                    ranking_type=ranking_type,
                    market_type=market_type,
                    rank=item['rank'],
                    stock_code=item['stock_code'],
                    stock_name=item['stock_name'],
                    current_price=item.get('current_price', ''),
                    change=item.get('change', ''),
                    change_percent=item.get('change_percent', ''),
                    volume=item.get('volume', ''),
                    amount=item.get('amount', ''),
                    collected_at=collected_at,
                    collected_time=collected_time,
                )
                db.add(new_ranking)
            
            db.commit()
            print(f"✅ {ranking_type} ({market_type}) 데이터 저장 완료: {len(data)}건")
            
        except Exception as e:
            db.rollback()
            print(f"❌ 데이터 저장 오류: {e}")
            raise


# 전역 서비스 인스턴스
naver_finance_service = NaverFinanceService()

