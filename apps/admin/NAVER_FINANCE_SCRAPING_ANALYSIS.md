# 네이버 금융 웹 스크래핑 분석

## 요청한 데이터 항목별 네이버 금융 페이지 분석

### 1. 상한가/하한가 종목

#### 제공 페이지
- **상한가**: https://finance.naver.com/sise/sise_upper.naver
- **하한가**: https://finance.naver.com/sise/sise_lower.naver

#### 데이터 구조 (추정)
- 테이블 형태로 종목코드, 종목명, 현재가, 등락률, 거래량 등 표시
- HTML 테이블 파싱 가능

#### 스크래핑 가능성
- ✅ **가능**: 정적 HTML 구조로 파싱 가능
- **필요 라이브러리**: `beautifulsoup4`, `httpx` 또는 `requests`
- **주의사항**: 
  - robots.txt 확인 필요
  - 과도한 요청 시 IP 차단 가능
  - 페이지 구조 변경 시 파싱 로직 수정 필요

---

### 2. 주도 테마

#### 제공 페이지
- **테마별 종목**: https://finance.naver.com/sise/sise_group.naver
- **인기 테마**: 메인 페이지에서 확인 가능

#### 데이터 구조 (추정)
- 테마별로 그룹화된 종목 목록
- 테마명, 관련 종목, 등락률 등 표시

#### 스크래핑 가능성
- ⚠️ **부분 가능**: 페이지 구조에 따라 파싱 가능하지만 복잡할 수 있음
- **주의사항**:
  - 테마 정보는 동적으로 로드될 수 있음
  - JavaScript 렌더링 필요 시 Selenium 필요
  - 네이버 금융의 테마 분류는 자체 기준이므로 업데이트 확인 필요

---

### 3. 52주 신고가

#### 제공 페이지
- **종목별 상세 페이지**: https://finance.naver.com/item/main.naver?code=종목코드
- **시세 정보 섹션**에 52주 최고가/최저가 표시

#### 데이터 구조 (추정)
```html
<!-- 예시 구조 (실제 확인 필요) -->
<div class="wrap_company">
  <dl>
    <dt>52주최고</dt>
    <dd>가격</dd>
    <dt>52주최저</dt>
    <dd>가격</dd>
  </dl>
</div>
```

#### 스크래핑 가능성
- ✅ **가능**: 종목별로 페이지 조회 필요
- **구현 방법**:
  1. 전체 종목 코드 리스트 필요 (KRX API 또는 다른 소스에서 가져오기)
  2. 각 종목 상세 페이지를 순회하며 52주 신고가 추출
  3. **주의**: 많은 요청이 발생하여 Rate Limiting 고려 필요

---

### 4. 기관 순매수/순매도

#### 제공 페이지
- **종목별 투자자별 매매동향**: 
  - https://finance.naver.com/item/frgn.naver?code=종목코드 (외국인)
  - https://finance.naver.com/item/sise.naver?code=종목코드 (기관 투자자별)

#### 데이터 구조 (추정)
- 일별 또는 주별 기관/외국인 매매 현황 테이블
- 순매수/순매도 금액 및 수량 표시

#### 스크래핑 가능성
- ✅ **가능**: 테이블 형태로 파싱 가능
- **구현 방법**:
  1. 종목별 상세 페이지에서 투자자별 매매동향 섹션 추출
  2. 일별 데이터를 수집하여 순매수/순매도 계산
  3. **주의**: 많은 종목을 순회해야 하므로 요청량이 많음

---

### 5. 외국인 순매수/순매도

#### 제공 페이지
- **외국인 매매동향**: https://finance.naver.com/item/frgn.naver?code=종목코드
- **전체 외국인 매매 현황**: https://finance.naver.com/sise/sise_deposit.naver

#### 데이터 구조 (추정)
- 외국인 매수/매도 수량 및 금액
- 보유율 변화 등 추가 정보

#### 스크래핑 가능성
- ✅ **가능**: 기관 순매수와 유사한 구조

---

## 기술적 구현 방안

### 필요한 라이브러리

```txt
beautifulsoup4==4.12.0  # HTML 파싱
lxml==4.9.0              # XML/HTML 파서 (beautifulsoup4와 함께 사용)
httpx==0.28.1            # 비동기 HTTP 클라이언트 (이미 설치됨)
selenium==4.15.0         # JavaScript 렌더링 필요 시 (선택사항)
fake-useragent==1.4.0    # User-Agent 랜덤화
```

### 기본 스크래핑 코드 구조

```python
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict
import time

class NaverFinanceScraper:
    def __init__(self):
        self.base_url = "https://finance.naver.com"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    async def fetch_limit_up_stocks(self) -> List[Dict]:
        """상한가 종목 조회"""
        url = f"{self.base_url}/sise/sise_upper.naver"
        async with httpx.AsyncClient(headers=self.headers, timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'lxml')
            # 테이블 파싱 로직 구현
            # ...
            
    async def fetch_limit_down_stocks(self) -> List[Dict]:
        """하한가 종목 조회"""
        url = f"{self.base_url}/sise/sise_lower.naver"
        # 구현 로직
        # ...
        
    async def fetch_investor_trading(self, stock_code: str) -> Dict:
        """종목별 기관/외국인 매매동향 조회"""
        # 구현 로직
        # ...
```

---

## 법적 및 기술적 고려사항

### 1. 법적 리스크

#### ⚠️ 주의사항
- **네이버 이용약관 위반 가능성**: 대량의 자동화된 요청은 이용약관 위반일 수 있음
- **개인정보보호법**: 수집한 데이터의 사용 목적 및 범위 고려
- **저작권**: 네이버 금융의 데이터베이스 저작권 문제 가능

#### 권장사항
- robots.txt 확인 및 준수
- 요청 간격 조절 (Rate Limiting)
- 개인/교육 목적 사용 권장
- 상업적 이용 시 법률 자문 필요

### 2. 기술적 제약사항

#### Rate Limiting
- 과도한 요청 시 IP 차단 가능
- **권장**: 요청 간 최소 1-2초 대기
- **대안**: 프록시 사용 (추가 복잡도)

#### 페이지 구조 변경
- 네이버 금융 페이지 구조 변경 시 스크래핑 로직 수정 필요
- **권장**: 정기적인 모니터링 및 테스트

#### JavaScript 렌더링
- 일부 데이터는 JavaScript로 동적 로드
- **해결책**: Selenium 또는 Playwright 사용 (성능 저하)

---

## 대안: 공식 API 우선 고려

### 1. KRX Open API (우선 추천)
- ✅ 공식 데이터, 무료, 안정적
- ✅ 법적 리스크 없음
- ⚠️ 일부 데이터는 추가 처리 필요

### 2. 한국투자증권 API
- ✅ 공식 API 제공
- ⚠️ 가입 및 인증 필요
- ⚠️ 사용량 제한 가능

### 3. 공공데이터포털
- ✅ 정부 공식 데이터
- ⚠️ 실시간성 제한
- ⚠️ 데이터 구조 복잡

---

## 구현 우선순위 제안

### Phase 1: KRX Open API 우선 검토
1. KRX Open API 명세서 확인
2. 필요한 엔드포인트 테스트
3. 데이터 파싱 및 저장 로직 구현

### Phase 2: 부족한 데이터 보완 (네이버 금융 스크래핑)
1. **상한가/하한가 종목**: 네이버 금융 스크래핑 (구현 난이도: 낮음)
2. **52주 신고가**: KRX API로 종목별 시세 수집 후 계산 (권장)
3. **기관/외국인 순매수**: KRX API 우선 확인 후 네이버 금융 보완

### Phase 3: 주도 테마 (가장 복잡)
- 네이버 금융 테마 페이지 스크래핑
- 또는 증권사 API 활용 검토

---

## 결론 및 권장사항

### 네이버 금융 스크래핑 가능성: ✅ **부분 가능**

#### 구현 가능한 항목
1. ✅ **상한가/하한가 종목** - 구현 난이도: ⭐⭐ (쉬움)
2. ✅ **52주 신고가** - 구현 난이도: ⭐⭐⭐ (중간, 많은 요청 필요)
3. ✅ **기관/외국인 순매수** - 구현 난이도: ⭐⭐⭐ (중간, 많은 요청 필요)
4. ⚠️ **주도 테마** - 구현 난이도: ⭐⭐⭐⭐ (어려움, 구조 복잡)

#### 최종 권장사항

**1단계: KRX Open API 우선 활용**
- 공식 데이터로 법적 리스크 없음
- 안정성 높음

**2단계: 부족한 데이터만 네이버 금융으로 보완**
- 상한가/하한가 종목: 네이버 금융 스크래핑
- 주도 테마: 네이버 금융 스크래핑 (구현 복잡)

**3단계: Rate Limiting 및 에러 처리**
- 요청 간격 조절
- IP 차단 대응
- 페이지 구조 변경 감지 및 대응

---

## 다음 단계

1. **KRX Open API 명세서 상세 확인**
   - 투자자별 매매동향 API 존재 여부 확인
   - 상한가/하한가 관련 API 확인

2. **네이버 금융 페이지 구조 실제 확인**
   - 개발자 도구로 HTML 구조 분석
   - 필요한 데이터 위치 파악

3. **POC (Proof of Concept) 구현**
   - 상한가 종목 스크래핑 간단한 테스트
   - 데이터 추출 성공 여부 확인

4. **데이터베이스 설계**
   - 스크래핑한 데이터를 저장할 모델 설계
   - 기존 데이터와의 통합 방안

