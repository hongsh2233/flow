# 네이버 금융 스크래핑 구현 위치 비교

## 현재 프로젝트 구조 분석

### Next.js API Route 패턴 (이미 구현된 사례)
- ✅ `/api/naver-news` - 네이버 뉴스 API 호출
- ✅ `/api/exchange-rate` - 야후 파이낸스 API 호출
- ✅ `/api/domestic-indices` - 국내 지수 데이터
- ✅ `/api/usa-indices` - 미국 지수 데이터

### Python 백엔드 패턴 (이미 구현된 사례)
- ✅ `app/services/api_service.py` - KRX API, FSC API 호출
- ✅ 데이터베이스 저장 및 캐싱
- ✅ 스케줄링 가능

---

## 비교 분석

### 1. Next.js API Route (프론트엔드) 구현

#### ✅ 장점
1. **기존 패턴 활용**: 이미 외부 API 호출 패턴이 있음
2. **빠른 구현**: 추가 인프라 구성 불필요
3. **CORS 문제 없음**: 서버 측에서 실행
4. **배포 간단**: Vercel 등에서 자동 배포
5. **실시간 호출**: 클라이언트 요청 시 즉시 실행

#### ❌ 단점
1. **HTML 파싱 복잡**: JavaScript에서 HTML 파싱이 Python보다 불편
   - `cheerio` 또는 `jsdom` 라이브러리 필요
   - BeautifulSoup보다 덜 직관적
2. **서버 리소스 제한**: 
   - Vercel 함수 실행 시간 제한 (10초 ~ 60초)
   - 메모리 제한
3. **Rate Limiting 관리 어려움**: 
   - 클라이언트 요청 시마다 실행
   - IP 차단 위험 높음
4. **데이터 캐싱 복잡**: 
   - 별도 캐싱 로직 필요 (Redis 등)
   - DB 저장 시 별도 API 호출 필요
5. **디버깅 어려움**: 서버리스 환경에서 로그 확인 제한

#### 구현 방법
```typescript
// app/api/naver-finance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch('https://finance.naver.com/sise/sise_upper.naver', {
      headers: {
        'User-Agent': 'Mozilla/5.0...'
      }
    })
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // HTML 파싱 로직
    const stocks = []
    $('.type_1 tbody tr').each((i, elem) => {
      // 파싱 로직
    })
    
    return NextResponse.json({ success: true, data: stocks })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed' }, { status: 500 })
  }
}
```

**필요 라이브러리:**
```json
{
  "cheerio": "^1.0.0",
  "@types/cheerio": "^0.22.0"
}
```

---

### 2. Python 백엔드 구현

#### ✅ 장점
1. **강력한 HTML 파싱**: 
   - BeautifulSoup + lxml 조합
   - 파싱 로직이 간결하고 강력함
   - CSS Selector, XPath 등 다양한 방법 지원
2. **데이터 캐싱 용이**:
   - DB 저장 및 조회 간단
   - 중복 요청 방지
3. **Rate Limiting 관리 용이**:
   - 서버에서 일괄 관리
   - 요청 간격 제어 가능
4. **스케줄링 가능**:
   - 정기적으로 데이터 수집
   - 백그라운드 작업 가능
5. **에러 처리 및 로깅**:
   - 서버 로그 확인 용이
   - 디버깅 편리
6. **확장성**:
   - 향후 다른 스크래핑 작업 추가 용이
   - 배치 작업 처리 가능

#### ❌ 단점
1. **추가 개발 작업**:
   - 서비스 클래스 구현
   - 라우터 엔드포인트 추가
   - API 통합 필요
2. **인프라 관리**:
   - 서버 실행 필요
   - (이미 FastAPI 서버가 있으므로 추가 부담은 적음)

#### 구현 방법
```python
# app/services/naver_finance_service.py
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict

class NaverFinanceService:
    async def fetch_limit_up_stocks(self) -> List[Dict]:
        url = "https://finance.naver.com/sise/sise_upper.naver"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={'User-Agent': '...'})
            soup = BeautifulSoup(response.text, 'lxml')
            
            stocks = []
            table = soup.find('table', class_='type_1')
            for row in table.find('tbody').find_all('tr'):
                # 파싱 로직 (BeautifulSoup 사용)
                stocks.append({...})
            
            return stocks
```

**필요 라이브러리:**
```txt
beautifulsoup4==4.12.0
lxml==4.9.0
fake-useragent==1.4.0
```

---

## 추천: Python 백엔드 구현 ✅

### 이유

1. **스크래핑 작업 특성상 Python이 적합**
   - HTML 파싱이 주 작업
   - BeautifulSoup이 cheerio보다 강력하고 직관적
   - 다양한 파싱 방법 지원

2. **데이터 관리 용이**
   - DB 저장 및 캐싱 필요
   - 중복 요청 방지 중요
   - 기존 KRX, FSC 데이터와 통합 가능

3. **Rate Limiting 및 안정성**
   - 서버에서 일괄 관리
   - IP 차단 위험 최소화
   - 에러 처리 및 재시도 로직 구현 용이

4. **확장성**
   - 향후 다른 스크래핑 작업 추가 용이
   - 배치 작업, 스케줄링 가능
   - 기존 API 서비스 패턴과 일관성

5. **이미 Python 백엔드 인프라 존재**
   - FastAPI 서버 실행 중
   - 추가 인프라 구성 불필요
   - 기존 패턴 활용 가능

---

## 최종 권장사항

### Python 백엔드 구현 (우선 추천) ⭐⭐⭐⭐⭐

**구현 계획:**
1. `app/services/naver_finance_service.py` 생성
2. BeautifulSoup으로 HTML 파싱
3. 데이터베이스 모델 추가 (필요시)
4. `app/routers/finance.py` 또는 새 라우터에 엔드포인트 추가
5. 프론트엔드에서 `/api/naver-finance/limit-up` 등 호출

**예상 작업 시간**: 2-3시간
**난이도**: 중간 (HTML 구조 파악이 중요)

---

### Next.js API Route (대안) ⭐⭐⭐

**구현 계획:**
1. `app/api/naver-finance/route.ts` 생성
2. cheerio로 HTML 파싱
3. 간단한 캐싱 (메모리 또는 Redis)

**예상 작업 시간**: 3-4시간 (파싱 로직 복잡도 증가)
**난이도**: 중상 (JavaScript HTML 파싱이 덜 직관적)

---

## 결론

**Python 백엔드 구현을 강력 추천합니다.**

이유:
- ✅ 스크래핑 작업에 최적화된 도구 (BeautifulSoup)
- ✅ 데이터 관리 및 캐싱 용이
- ✅ 안정성 및 확장성 우수
- ✅ 기존 인프라 활용 가능

네이버 금융은 공식 API가 없어 웹 스크래핑이 필요하므로, **파이썬의 강력한 HTML 파싱 도구를 활용하는 것이 효율적**입니다.

