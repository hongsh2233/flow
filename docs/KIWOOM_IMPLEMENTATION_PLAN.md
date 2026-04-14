# Search 페이지 검색 트렌드 섹션 추가

## Context
사용자가 프론트엔드 검색 페이지(`/search`)의 검색폼 위에 네이버 데이터랩 "테마섹터" 트렌드 데이터를 표시하는 섹션을 요청. 차트(위) + 5초 간격 자동 스크롤 키워드 리스트(아래) 구성.

## 구현 계획

### 1. Next.js API 프록시 라우트 생성
**파일:** `apps/web_new/app/api/naver-trend/route.ts`

- 기존 `naver-ranking/route.ts` 패턴 재사용
- `${API_BASE_URL}/api/naver-trend/data?category=테마섹터&time_unit=date`로 프록시
- `X-API-KEY` 헤더 포함
- 응답 형식: `{ success, data: [{ keyword_group, keywords, data: [{period, ratio}], ... }] }`

### 2. SearchTrendSection 컴포넌트 생성
**파일:** `apps/web_new/app/components/module/SearchTrendSection.tsx`

- `"use client"` 클라이언트 컴포넌트
- `useEffect`로 `/api/naver-trend` fetch (마운트 시 1회)
- **차트 영역**: SVG 라인 차트 (각 테마별 색상, 최근 30일 trend)
  - X축: 날짜, Y축: ratio (0~100)
  - 10개 테마 각각 polyline으로 렌더링
  - 범례 표시
- **키워드 리스트 영역**: 
  - 테마명 + 키워드 목록 테이블
  - `overflow: hidden` 컨테이너 + `setInterval(5000)`으로 위로 스크롤
  - CSS `transition`으로 부드러운 스크롤 효과
  - 끝에 도달 시 처음으로 리셋

### 3. 검색 페이지에 섹션 삽입
**파일:** `apps/web_new/app/search/page.tsx`

- `SearchQueryPanel` 내부, `<div className={styles.searchArea}>` 바로 위에 삽입
- `<SearchTrendSection />` 컴포넌트 렌더링

### 4. CSS 스타일 추가
**파일:** `apps/web_new/app/search/SearchPage.module.css`

- `.trendSection` — 전체 래퍼 (margin-bottom, border-radius, border)
- `.trendTitle` — "검색 트렌드" 제목
- `.trendChart` — SVG 차트 컨테이너
- `.trendListWrap` — 스크롤 영역 (max-height, overflow: hidden)
- `.trendListInner` — 실제 이동하는 내부 요소 (transition: transform)
- `.trendRow` — 테마 + 키워드 행

## 핵심 참조 파일
- 프록시 패턴: `apps/web_new/app/api/naver-ranking/route.ts`
- API 설정: `apps/web_new/lib/config/api.ts` (`API_BASE_URL`, `API_SECRET_KEY`)
- 백엔드 엔드포인트: `apps/admin/app/routers/finance.py:668` (`/api/naver-trend/data`)
- 테마 키워드: `apps/admin/app/services/naver_trend_service.py:35` (테마섹터 10개 그룹)

## 검증
- `/search` 페이지 접속 시 검색폼 위에 트렌드 차트 + 키워드 리스트 표시 확인
- 5초마다 키워드 리스트가 위로 스크롤되는지 확인
- API 에러 시 섹션이 조용히 숨겨지는지 확인 (에러 표시 없음)

---

# Kiwoom Securities REST API 통합 계획

## Context
사용자가 키움증권 REST API를 admin 백엔드에 통합하여 다음 기능 구현 요청:
- **자동매매 (Auto Trading)**: 설정 조건 기반 자동 주문
- **모의투자 (Mock Trading)**: 실제 주문 없이 시뮬레이션
- **시세 기반 검색식 (Price-based Screening)**: 실시간/과거 가격으로 검색 조건 필터링
- **범위**: 내부 운영용 (제3자 서비스 제공 X)
- **UI**: Admin 사이드바에 "Kiwoom" 메뉴 추가

**가능성 평가**: HIGH (기존 OAuth2 패턴, async httpx 클라이언트, service/router 구조 재사용 가능)

---

## 구현 전략: 3단계 점진적 구현

### Phase 1: 기초 인프라 (1주)
**목표**: Kiwoom API 기본 연동 및 토큰 관리

#### 1.1 Kiwoom 서비스 기본 클래스
**파일**: `apps/admin/app/services/kiwoom_service.py`
```python
class KiwoomService:
    - __init__(app_key, app_secret, is_mock=True)
    - async def get_access_token() → token (OAuth2, 토큰 캐싱)
    - async def call_tr(tr_code, params) → 제너릭 TR 호출
    - async def call_api(endpoint, method, data) → 제너릭 API 호출
```

**기본 설정**
- Kiwoom REST API 문서 기반 엔드포인트 매핑 (공식: [openapi.kiwoom.com](https://openapi.kiwoom.com) 가이드)
- OAuth2: `POST {base}/oauth2/token` — `base`는 운영 `https://api.kiwoom.com`, 모의 `https://mockapi.kiwoom.com` (환경변수 `KIWOOM_BASE_URL`로 덮어쓰기 가능)
- 국내주식 TR 예: `POST {base}/api/dostk/stkinfo`, `rkinfo`, `acnt`, `ordr`, `chart` 등 — 경로에 `/v1` 접두사 없음(구현과 동일)
- `.env` 변수: `KIWOOM_APP_KEY`, `KIWOOM_APP_SECRET`, `KIWOOM_USE_MOCK=true`

**참조 패턴**: `apps/admin/app/services/firebase_service.py` (OAuth2 토큰 관리)

#### 1.2 Router 뼈대
**파일**: `apps/admin/app/routers/kiwoom.py`
```
POST /api/kiwoom/auth/token — 토큰 갱신
GET  /api/kiwoom/health — API 연결 상태 확인
```

---

### Phase 2: 모의투자 (2-3주)
**목표**: 위험 없이 API 패턴 검증, PoC 완성

#### 2.1 모의투자 Service
**파일**: `apps/admin/app/services/kiwoom_mock_trading_service.py`
```python
class KiwoomMockTradingService:
    - async def get_balance() → {cash, positions}
    - async def place_order(order_spec) → order_id
    - async def get_orders() → [{order_id, status, ...}]
    - async def cancel_order(order_id) → result
    - async def get_portfolio() → {total_value, holdings}
```

#### 2.2 모의투자 Router
**파일**: `apps/admin/app/routers/kiwoom.py` (확장)
```
GET  /api/kiwoom/mock/balance — 모의 잔액 조회
POST /api/kiwoom/mock/order — 모의 주문
GET  /api/kiwoom/mock/orders — 주문 목록
DELETE /api/kiwoom/mock/order/{id} — 주문 취소
GET  /api/kiwoom/mock/portfolio — 포트폴리오
```

#### 2.3 Frontend: 모의투자 대시보드
**파일**: `apps/web_new/app/admin/kiwoom/mock/page.tsx`
- 잔액 표시
- 주문 폼 (종목명, 수량, 호가)
- 주문 목록 (상태별 필터)
- 포트폴리오 차트

**Auth 의존성**: `get_current_user` (쿠키)

#### 2.4 DB 스키마 (선택사항)
**파일**: `apps/admin/app/models.py` (신규 모델)
```python
class MockTradingAccount:
    id, user_id, initial_cash, current_cash
    
class MockPosition:
    id, account_id, symbol, quantity, avg_price
```

---

### Phase 3: 시세 기반 검색식 (2-3주)
**목표**: 기존 screening 서비스와 통합, FinanceDataReader 대체

#### 3.1 가격 데이터 Service
**파일**: `apps/admin/app/services/kiwoom_price_service.py`
```python
class KiwoomPriceService:
    - async def get_daily_prices(symbol, days=365) → [{date, close, high, low, volume}]
    - async def get_minute_prices(symbol, minutes=60) → [{time, price, volume}]
    - async def get_current_price(symbol) → {price, change_rate, ask, bid}
```

#### 3.2 Screening 통합
**파일**: `apps/admin/app/services/screening_service.py` (기존 수정)
- `KiwoomPriceService` 주입
- `FinanceDataReader` 호출 부분 → Kiwoom으로 대체
- 기존 ichimoku, jongbe, ricebowl, breakout 로직 유지

#### 3.3 Router
**파일**: `apps/admin/app/routers/kiwoom.py` (확장)
```
GET /api/kiwoom/prices/{symbol}?days=365 — 일봉 데이터
GET /api/kiwoom/price/{symbol}/current — 현재가
POST /api/kiwoom/screening/search — 검색식 실행 (가격 데이터 포함)
```

#### 3.4 Frontend: Screening 대시보드
**파일**: `apps/web_new/app/admin/kiwoom/screening/page.tsx`
- 기존 screening UI 유지
- Kiwoom 가격 데이터 차트 표시
- 검색 결과 실시간 갱신

---

### Phase 4: 자동매매 (3-4주, 향후 고려)
**목표**: 조건부 자동 주문 실행 (높은 주의 필요)

#### 4.1 위험도 관리
- **Confirmation 플로우**: 주문 실행 전 사용자 승인
- **Kill-switch**: 긴급 정지 버튼
- **Order Rate Limit**: Kiwoom TR 분당 호출 제한 (캐싱, 배치 처리)
- **Environment Separation**: mock API 검증 후 real API 전환

#### 4.2 Auto-Trading Service (스켈레톤)
**파일**: `apps/admin/app/services/kiwoom_auto_trading_service.py`
```python
class KiwoomAutoTradingService:
    - async def create_strategy(rule_spec) → strategy_id
    - async def execute_order(strategy_id) → order_id (Confirmation 필수)
    - async def monitor_strategy(strategy_id) → status
    - async def stop_strategy(strategy_id)
```

#### 4.3 Router
```
POST /api/kiwoom/strategies — 전략 생성
POST /api/kiwoom/strategies/{id}/execute — 주문 실행 (Confirmation 필수)
GET  /api/kiwoom/strategies/{id}/status — 전략 상태
DELETE /api/kiwoom/strategies/{id} — 전략 중지
```

---

## 파일 구조 요약

### Backend 신규/수정
```
apps/admin/
├── app/
│   ├── services/
│   │   ├── kiwoom_service.py               [NEW] 기본 OAuth + TR 호출
│   │   ├── kiwoom_mock_trading_service.py  [NEW] 모의투자
│   │   ├── kiwoom_price_service.py         [NEW] 가격 데이터
│   │   ├── kiwoom_auto_trading_service.py  [NEW] 자동매매 (향후)
│   │   └── screening_service.py            [MODIFY] Kiwoom 통합
│   ├── routers/
│   │   └── kiwoom.py                       [NEW] /api/kiwoom/* 엔드포인트
│   ├── models.py                           [MODIFY] MockTradingAccount, MockPosition 추가
│   └── config.py                           [MODIFY] KIWOOM_* 환경변수
```

### Frontend 신규
```
apps/web_new/
├── app/
│   ├── admin/kiwoom/
│   │   ├── page.tsx                        [NEW] Kiwoom 메인 대시보드
│   │   ├── mock/page.tsx                   [NEW] 모의투자 페이지
│   │   └── screening/page.tsx              [NEW] 시세 검색식 페이지
│   ├── components/module/
│   │   ├── KiwoomAuthPanel.tsx             [NEW] 연결 상태
│   │   ├── KiwoomMockTradingPanel.tsx      [NEW] 모의 주문 폼
│   │   ├── KiwoomPortfolioChart.tsx        [NEW] 포트폴리오 차트
│   │   └── KiwoomScreeningTable.tsx        [NEW] 검색 결과
│   └── styles/
│       └── KiwoomPage.module.css           [NEW] 스타일
├── lib/
│   └── kiwoom.ts                           [NEW] API 호출 유틸리티
```

### Admin Navigation (기존 수정)
**파일**: `apps/web_new/app/admin/layout.tsx` 또는 사이드바 컴포넌트
```
- [기존] 반응예상 / 급등예상
+ [NEW] Kiwoom
  ├─ 모의투자
  ├─ 시세 검색식
  └─ (향후) 자동매매
```

---

## 기술 요구사항

### Backend
- **httpx**: 비동기 HTTP (이미 사용 중)
- **APScheduler**: 조건 검사 & 자동 주문 (이미 사용 중)
- **SQLAlchemy ORM**: 전략/주문 기록 (이미 사용 중)
- **Kiwoom REST API 문서**: 앱 키/시크릿, TR 목록

### Frontend
- **Next.js App Router**: 페이지 라우팅 (이미 사용 중)
- **React Hooks**: useEffect, useState, useCallback (이미 사용 중)
- **Recharts 또는 SVG**: 차트 렌더링 (기존 패턴 재사용)

---

## 사용자(당신)가 준비할 것

1. **Kiwoom 계정 설정**
   - Kiwoom 공식 홈페이지에서 REST API 앱 등록
   - App Key, App Secret 획득
   - 앱 권한: 주식주문, 모의주문, 시세조회 선택

2. **.env 설정** (`apps/admin/.env.local`)
   ```
   KIWOOM_APP_KEY=<your_app_key>
   KIWOOM_APP_SECRET=<your_app_secret>
   KIWOOM_USE_MOCK=true  # 처음엔 true로 시작
   KIWOOM_ACCOUNT_NO=        # 계좌·주문 TR (kt00001 등)
   KIWOOM_ACCOUNT_PWD=       # 비밀번호(필요 시)
   KIWOOM_SCREENING_PRICE_SOURCE=fdr   # 또는 kiwoom (로그만, OHLCV는 아직 FDR)
   KIWOOM_KILL_SWITCH=true               # 자동 실행 차단(기본 on)
   KIWOOM_AUTO_TRADING_ENABLED=false     # 전략 실행 API
   KIWOOM_ORDER_KILL_SWITCH=false        # 수동 주문 API/BO 폼 차단 시 true
   ```

3. **초기 검증**
   - Phase 1 완료 후: 관리자 로그인(쿠키) 상태에서 `GET /api/kiwoom/health`, `POST /api/kiwoom/auth/token` 테스트 (`apps/admin/app/routers/kiwoom.py`)
   - Phase 2 완료 후: `GET /api/kiwoom/mock/balance`, `GET /api/kiwoom/mock/orders`, `POST /api/kiwoom/mock/order`(JSON `side`: buy/sell/cancel) 및 BO `/admin/kiwoom/mock`
   - Phase 3 완료 후: `GET /api/kiwoom/prices/{symbol}`, `GET /api/kiwoom/price/{symbol}/current`, BO `/admin/kiwoom/screening`에서 가격 소스 설정 확인
   - Phase 4: `GET/POST/DELETE /api/kiwoom/strategies`, `POST .../execute` (스켈레톤·안전 플래그)

---

## 검증 계획

### Phase 1 검증
```
✓ POST /api/kiwoom/auth/token → 정상 응답 (토큰 반환)
✓ GET  /api/kiwoom/health → 200 OK
```

### Phase 2 검증
```
✓ Admin > Kiwoom > 모의투자 페이지 접속
✓ 모의 잔액 조회 (GET /api/kiwoom/mock/balance)
✓ 주문 생성 → 목록에 표시
✓ 주문 취소 → 상태 업데이트
✓ 포트폴리오 차트 렌더링
```

### Phase 3 검증
```
✓ Admin > Kiwoom > 시세 검색식 페이지
✓ Screening 검색 실행 (Kiwoom 가격 데이터 사용)
✓ 결과 테이블 표시
✓ 차트에 Kiwoom 캔들 데이터 표시
```

### Phase 4 검증 (향후)
```
✓ 자동매매 전략 생성
✓ 주문 실행 시 Confirmation 팝업 표시
✓ Kill-switch 버튼 동작 확인
✓ 실제 주문 전에 mock API로 충분히 테스트
```

---

## 위험도 & 완화 전략

| 항목 | 위험도 | 완화 전략 |
|------|--------|---------|
| **자동 주문 실수** | 🔴 HIGH | Confirmation 플로우, Kill-switch, audit log |
| **API 호출 제한** | 🟡 MEDIUM | 캐싱, 배치 처리, rate-limit 모니터링 |
| **토큰 갱신 실패** | 🟡 MEDIUM | Retry 로직, 토큰 캐싱, 에러 알림 |
| **Mock/Real 환경 혼동** | 🟡 MEDIUM | .env 명확한 주석, UI에 Mock/Real 표시 |
| **내부용 정책 위반** | 🔴 HIGH | 코드 리뷰, 제3자 API 미노출, auth 강화 |

---

## 일정 요약

| Phase | 소요 기간 | 시작점 | 체크포인트 |
|-------|-----------|--------|-----------|
| **1. 기초 인프라** | 1주 | 토큰 관리 | health API 동작 |
| **2. 모의투자** | 2-3주 | Service + Router | 모의 주문 생성/조회 |
| **3. 가격 통합** | 2-3주 | 시세 Service | Screening 검색식 실행 |
| **4. 자동매매** | 3-4주 (선택) | Strategy Service | 주문 실행 (안전장치 필수) |

**총 예상 기간**: 5-9주 (모든 Phase 포함)
