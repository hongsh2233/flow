# 주리니(Jurini) 프로젝트 분석 문서

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [페이지 구조](#4-페이지-구조)
5. [컴포넌트 아키텍처](#5-컴포넌트-아키텍처)
6. [API 호출 및 데이터 패칭](#6-api-호출-및-데이터-패칭)
7. [상태 관리](#7-상태-관리)
8. [인증 시스템](#8-인증-시스템)
9. [라우팅 구조](#9-라우팅-구조)
10. [설정 파일](#10-설정-파일)
11. [환경 변수](#11-환경-변수)

---

## 1. 프로젝트 개요

**프로젝트명:** 주리니 (Jurini)
**프로젝트 유형:** 한국 주식 시장 정보 및 커뮤니티 웹 애플리케이션
**주요 기능:**
- 실시간 주식 정보 조회 (KOSPI, KOSDAQ)
- 관심 종목 관리
- 뉴스 및 공시 정보
- 일정/공휴일 캘린더
- 글로벌 게시판
- 소셜 로그인 (Google, Naver)

---

## 2. 기술 스택

### Frontend Framework
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.1 | App Router 기반 프레임워크 |
| React | 19.2.3 | UI 라이브러리 |
| TypeScript | 5.x | 정적 타입 지원 |

### UI & 스타일링
| 기술 | 버전 | 용도 |
|------|------|------|
| Material-UI (MUI) | 7.3.5 | UI 컴포넌트 라이브러리 |
| Emotion | - | CSS-in-JS |
| Tailwind CSS | 4.x | 유틸리티 기반 CSS |
| CSS Modules | - | 컴포넌트 스코프 스타일링 |
| Swiper | 12.0.3 | 캐러셀/슬라이더 |

### 상태 관리
| 기술 | 버전 | 용도 |
|------|------|------|
| Zustand | 5.0.10 | 전역 상태 관리 |

### 인증
| 기술 | 버전 | 용도 |
|------|------|------|
| NextAuth.js | 4.24.13 | OAuth2 인증 |

### 개발 도구
| 기술 | 버전 | 용도 |
|------|------|------|
| Jest | 30.2.0 | 테스트 프레임워크 |
| ESLint | 9.x | 코드 린팅 |
| Prettier | - | 코드 포맷팅 |
| Node.js | 20.19.6 | 런타임 (Volta 관리) |

---

## 3. 디렉토리 구조

```
/home/user/stock/
├── app/                          # Next.js App Router (메인 애플리케이션)
│   ├── components/               # 재사용 가능한 컴포넌트
│   │   ├── layout/              # 레이아웃 컴포넌트
│   │   ├── element/             # 기본 UI 요소
│   │   ├── module/              # 복합 기능 컴포넌트
│   │   ├── main/                # 메인 페이지 전용 컴포넌트
│   │   └── providers/           # Context Provider
│   ├── api/                     # API 라우트
│   │   ├── auth/[...nextauth]/  # NextAuth 핸들러
│   │   ├── domestic-indices/    # 국내 지수
│   │   ├── usa-indices/         # 미국 지수
│   │   ├── exchange-rate/       # 환율
│   │   ├── banners/             # 배너
│   │   ├── naver-news/          # 네이버 뉴스
│   │   ├── quotes/              # 주식 시세
│   │   └── stock-to-corp/       # 종목-기업 매핑
│   ├── login/                   # 로그인 페이지
│   ├── register/                # 회원가입 페이지
│   ├── stock_info/              # 주식 정보 페이지
│   ├── news/                    # 뉴스 페이지
│   ├── disclosure/              # 공시 정보 페이지
│   ├── schedule/                # 일정 페이지
│   ├── setting/                 # 설정 페이지
│   ├── global/                  # 글로벌 게시판
│   ├── layout.tsx               # 루트 레이아웃
│   └── page.tsx                 # 홈페이지
│
├── lib/                          # 공유 라이브러리
│   ├── config/                  # 설정
│   │   └── api.ts               # API 설정
│   ├── services/                # API 서비스 함수
│   │   ├── authService.ts       # 인증 서비스
│   │   ├── fscService.ts        # FSC 주가 데이터
│   │   ├── krxService.ts        # KRX 시장 데이터
│   │   ├── naverFinanceService.ts # 네이버 금융
│   │   ├── scheduleService.ts   # 일정 서비스
│   │   ├── boardService.ts      # 게시판 서비스
│   │   ├── mainPageService.ts   # 메인 페이지 설정
│   │   ├── collectedDataService.ts # 수집 데이터
│   │   └── holidayService.ts    # 공휴일 서비스
│   ├── stores/                  # Zustand 스토어
│   │   └── useFavoriteStore.ts  # 관심종목 스토어
│   ├── types/                   # TypeScript 타입 정의
│   └── hooks/                   # 커스텀 훅
│
├── src/                          # 추가 유틸리티
├── data/                         # 개발용 목 데이터
│   └── mock/                    # 목 데이터 파일
├── assets/                       # 정적 자산
│   └── css/                     # 전역 CSS
├── public/                       # 퍼블릭 정적 파일
│
└── 설정 파일들
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── jest.config.ts
    └── eslint.config.mjs
```

---

## 4. 페이지 구조

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | `app/page.tsx` | 홈페이지 - 동적 컴포넌트 구성 |
| `/login` | `app/login/page.tsx` | 소셜 로그인 (Google, Naver) |
| `/register` | `app/register/page.tsx` | 신규 사용자 프로필 설정 |
| `/stock_info` | `app/stock_info/page.tsx` | 주식 정보 (관심종목, 시황, 급등, 시총) |
| `/news` | `app/news/page.tsx` | 뉴스 페이지 |
| `/disclosure` | `app/disclosure/page.tsx` | 기업 공시 정보 |
| `/schedule` | `app/schedule/page.tsx` | 이벤트/공휴일 캘린더 |
| `/setting` | `app/setting/page.tsx` | 사용자 설정 |
| `/global` | `app/global/page.tsx` | 글로벌 게시판 |

---

## 5. 컴포넌트 아키텍처

### 5.1 레이아웃 컴포넌트 (`app/components/layout/`)

| 컴포넌트 | 설명 |
|----------|------|
| `Header.tsx` | 상단 네비게이션 헤더 |
| `BottomNav.tsx` | 하단 네비게이션 메뉴 (모바일 퍼스트) |
| `NaviList.tsx` | 네비게이션 리스트 |
| `Icon.tsx` | 아이콘 컴포넌트 |

### 5.2 기본 UI 요소 (`app/components/element/`)

| 컴포넌트 | 설명 |
|----------|------|
| `PageTitle.tsx` | 페이지 제목 |
| `Button.tsx` | 커스텀 버튼 |
| `Modal.tsx` | 모달 다이얼로그 |
| `Accordion.tsx` | 아코디언 |
| `AsyncContent.tsx` | 비동기 콘텐츠 래퍼 |
| `IconButton.tsx` | 아이콘 버튼 |
| `tabsUi/` | 탭 컴포넌트 (Tabs, TabList, TabPanel, TabCont) |

### 5.3 모듈 컴포넌트 (`app/components/module/`)

```
module/
├── stock/
│   ├── StockList.tsx         # 주식 목록 (관심종목 토글 포함)
│   └── StockNews.tsx         # 종목별 뉴스
├── swiper/
│   └── BasicSwiper.tsx       # 이미지 캐러셀
├── Calendar/
│   ├── Calendar.tsx          # 캘린더 뷰
│   ├── WeeklyDay.tsx         # 주간 뷰
│   ├── MonthlyDay.tsx        # 월간 뷰
│   └── ScaduleList.tsx       # 일정 목록
├── Board.tsx                 # 게시판 표시
├── MessageBox.tsx            # 메시지/알림 박스
├── NewsList.tsx              # 일반 뉴스 목록
├── NaverNews.tsx             # 네이버 뉴스 통합
└── GlobalBoardSummary.tsx    # 글로벌 토론 요약
```

### 5.4 메인 페이지 컴포넌트 (`app/components/main/`)

| 컴포넌트 | 설명 |
|----------|------|
| `MainTop.tsx` | 상단 배너 |
| `StockIndex.tsx` | KOSPI/KOSDAQ 표시 |
| `UsaIndex.tsx` | 미국 지수 표시 |
| `ExchangeRate.tsx` | 환율 표시 |

### 5.5 Provider (`app/components/providers/`)

| 컴포넌트 | 설명 |
|----------|------|
| `NextAuthProvider.tsx` | 인증 Provider 래퍼 |

---

## 6. API 호출 및 데이터 패칭

### 6.1 API 설정 (`lib/config/api.ts`)

```typescript
// 기본 설정
const API_BASE_URL = 'https://stock-bo-production.up.railway.app'
const API_SECRET_KEY = process.env.NEXT_PUBLIC_X_API_KEY

// 헤더 구성
headers: {
  'Content-Type': 'application/json',
  'X-API-KEY': API_SECRET_KEY,
  'Authorization': `Bearer ${token}` // 인증된 경우
}
```

### 6.2 서비스 레이어 아키텍처

#### 인증 서비스 (`lib/services/authService.ts`)

| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `login()` | POST | `/api/auth/token` | 아이디/비밀번호 로그인 |
| `autoLogin()` | POST | `/api/auth/token` | 환경변수 자동 로그인 |
| `socialLogin()` | POST | `/api/auth/social-login` | Google/Naver 소셜 로그인 |
| `updateMember()` | PUT | `/api/auth/member/update` | 프로필 업데이트 |
| `getFavoriteStocks()` | GET | `/api/auth/member/favorites` | 관심종목 조회 |
| `addFavoriteStock()` | POST | `/api/auth/member/favorites` | 관심종목 추가 |
| `removeFavoriteStock()` | DELETE | `/api/auth/member/favorites` | 관심종목 삭제 |
| `getCharacters()` | GET | `/api/auth/characters` | 아바타 캐릭터 조회 |
| `getStockWords()` | GET | `/api/auth/stock-words` | 주식 용어 조회 |
| `withdrawMember()` | DELETE | `/api/auth/member/withdraw` | 계정 삭제 |
| `logout()` | - | - | 토큰 클리어 |

#### 주식 데이터 서비스

**FSC 서비스 (`lib/services/fscService.ts`)**
| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `fetchFscStockPrices()` | GET | `/api/fsc-stock-price` | FSC 주가 데이터 |
| `fetchFscStockDates()` | GET | `/api/fsc-stock-price/dates` | 이용 가능 날짜 |

**KRX 서비스 (`lib/services/krxService.ts`)**
| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `fetchKrxData()` | GET | `/api/krx-data` | KRX 시장 데이터 |
| `fetchKrxDates()` | GET | `/api/krx-data/dates` | 이용 가능 날짜 |

**네이버 금융 서비스 (`lib/services/naverFinanceService.ts`)**
| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `fetchLimitUpStocks()` | GET | `/api/naver-finance/limit-up` | 상한가 종목 |
| `fetchLimitDownStocks()` | GET | `/api/naver-finance/limit-down` | 하한가 종목 |

#### 콘텐츠 서비스

**일정 서비스 (`lib/services/scheduleService.ts`)**
| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `fetchSchedules()` | GET | `/api/schedules` | 일정 목록 |
| `fetchScheduleDetail()` | GET | `/api/schedules/{id}` | 일정 상세 |

**게시판 서비스 (`lib/services/boardService.ts`)**
| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `fetchBoards()` | GET | `/api/boards` | 게시판 목록 |
| `fetchBoardPosts()` | GET | `/api/boards/{id}/posts` | 게시판 글 목록 |
| `fetchPostDetail()` | GET | `/api/posts/{id}` | 글 상세 |

**메인 페이지 서비스 (`lib/services/mainPageService.ts`)**
| 함수 | HTTP | 엔드포인트 | 설명 |
|------|------|------------|------|
| `fetchMainPageConfig()` | GET | `/api/main-page-config` | 페이지 레이아웃 설정 |

### 6.3 Next.js API 라우트

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/auth/[...nextauth]` | ALL | NextAuth OAuth 콜백 |
| `/api/domestic-indices` | GET | 국내 지수 (Yahoo Finance) |
| `/api/usa-indices` | GET | 미국 지수 |
| `/api/exchange-rate` | GET | 환율 |
| `/api/banners` | GET | 배너 관리 |
| `/api/naver-news` | GET | 뉴스 조회 |
| `/api/quotes` | GET | 주식 시세 |
| `/api/stock-to-corp` | GET | 종목-기업 매핑 |

### 6.4 데이터 패칭 패턴

```typescript
// 일반적인 서비스 함수 구조
export async function fetchData(params?): Promise<ApiResponse<T>> {
  // 1. 목 데이터 폴백 체크
  if (USE_MOCK_DATA) {
    await simulateDelay(300)
    return mockDataResponse
  }

  // 2. 실제 API 호출
  try {
    const response = await fetch(url, {
      headers: getAuthHeaders()
    })

    // 3. 에러 핸들링
    if (!response.ok) {
      return errorResponse
    }

    return await response.json()
  } catch (error) {
    // 4. 에러 시 목 데이터로 폴백
    return mockDataFallback
  }
}
```

### 6.5 API 응답 타입

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  count?: number
  detail?: string
  message?: string
}
```

---

## 7. 상태 관리

### 7.1 Zustand 스토어

**관심종목 스토어 (`lib/stores/useFavoriteStore.ts`)**

```typescript
interface FavoriteStore {
  favCodes: Set<string>           // 관심종목 코드 집합
  setFavCodes(codes: string[]): void  // 전체 설정
  addFavCode(code: string): void      // 추가
  removeFavCode(code: string): void   // 삭제
  clearFavCodes(): void               // 초기화
}
```

**스토어 특징:**
- Redux DevTools 통합 (디버깅)
- Persist 미들웨어 (localStorage: 'favorite-storage')
- 커스텀 직렬화 (Set ↔ Array 변환)
- 관심종목 코드의 단일 진실 공급원

### 7.2 상태 관리 패턴

| 유형 | 기술 | 용도 |
|------|------|------|
| 전역 상태 | Zustand | 관심종목 (영구 저장) |
| 로컬 상태 | useState | 페이지별 데이터, 로딩, 필터 |
| 세션 상태 | NextAuth | 사용자 인증, 프로필 |
| 커스텀 훅 | useFavoriteStocks | Zustand + API + 데이터 매핑 |

### 7.3 커스텀 훅 패턴

```typescript
export function useFavoriteStocks() {
  const { favCodes, setFavCodes } = useFavoriteStore()
  const [allStockData, setAllStockData] = useState<FscStockPrice[]>([])

  // 메모이제이션된 관심종목 필터링
  const favoriteStocks = useMemo(() => {
    return allStockData
      .filter(item => favCodes.has(item.srtn_cd))
      .map(mapToStockItem)
  }, [allStockData, favCodes])

  return { favCodes, allStockData, favoriteStocks, isLoading, mapToStockItem }
}
```

---

## 8. 인증 시스템

### 8.1 NextAuth 설정

**Provider:** Google, Naver OAuth2

**설정 위치:** `app/api/auth/[...nextauth]/route.ts`

### 8.2 인증 흐름

```
1. 사용자가 Google/Naver 로그인 클릭
         ↓
2. NextAuth가 OAuth 콜백 처리
         ↓
3. 프론트엔드가 소셜 로그인 데이터를 백엔드로 전송
         ↓
4. 백엔드가 사용자 프로필 생성/업데이트
         ↓
5. 백엔드가 멤버 정보 반환 (닉네임, 프로필 이미지)
         ↓
6. NextAuth 세션에 토큰 및 사용자 정보 저장
         ↓
7. 이후 API 호출에 Authorization 헤더에 Bearer 토큰 포함
```

### 8.3 세션 구조

```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    image?: string
  }
  accessToken: string
  isNewUser: boolean  // 닉네임 상태 기반
}
```

---

## 9. 라우팅 구조

### 9.1 Next.js App Router

- 파일 기반 라우팅 (`page.tsx` 파일 사용)
- 동적 라우트: `/api/auth/[...nextauth]` (NextAuth catch-all)
- 중첩 레이아웃 지원

### 9.2 네비게이션 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| Header | 상단 | 상단 네비게이션 |
| BottomNav | 하단 | 하단 탭 네비게이션 (모바일 퍼스트) |

### 9.3 프로그래매틱 라우팅

```typescript
import { useRouter } from 'next/navigation'

const router = useRouter()
router.push('/stock_info')
```

---

## 10. 설정 파일

### 10.1 TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 10.2 Next.js (`next.config.ts`)

```typescript
// 프로덕션 빌드에서 콘솔 로그 제거
// 에러 및 경고 로그는 유지
```

### 10.3 Tailwind CSS (`tailwind.config.ts`)

- PostCSS 통합
- 커스텀 테마 설정

---

## 11. 환경 변수

### 11.1 필수 환경 변수

```env
# API 설정
NEXT_PUBLIC_API_BASE_URL=https://stock-bo-production.up.railway.app
NEXT_PUBLIC_X_API_KEY=<api_secret_key>

# OAuth 설정
GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>
NAVER_CLIENT_LOGIN_ID=<naver_client_id>
NAVER_CLIENT_LOGIN_SECRET=<naver_client_secret>

# NextAuth
NEXTAUTH_SECRET=<nextauth_secret>
NEXTAUTH_URL=<app_url>
```

### 11.2 선택적 환경 변수

```env
# 개발 모드
NEXT_PUBLIC_USE_MOCK_DATA=true

# 공공데이터 포털
DATA_GO_KR_API_KEY=<public_data_portal_key>
```

---

## 12. 백엔드 통합

### 12.1 백엔드 정보

| 항목 | 값 |
|------|-----|
| URL | https://stock-bo-production.up.railway.app |
| 플랫폼 | Railway.app |
| 프레임워크 | FastAPI (추정) |
| 인증 | OAuth2 form-data |

### 12.2 백엔드 API 엔드포인트 요약

```
인증:
  POST   /api/auth/token                    → 로그인
  POST   /api/auth/social-login             → 소셜 로그인
  PUT    /api/auth/member/update            → 프로필 업데이트
  GET    /api/auth/member/info              → 사용자 정보
  GET    /api/auth/member/favorites         → 관심종목 조회
  POST   /api/auth/member/favorites         → 관심종목 추가
  DELETE /api/auth/member/favorites         → 관심종목 삭제
  DELETE /api/auth/member/withdraw          → 계정 삭제
  GET    /api/auth/characters               → 아바타
  GET    /api/auth/stock-words              → 주식 용어

게시판:
  GET    /api/boards                        → 게시판 목록
  GET    /api/boards/{id}                   → 게시판 상세
  GET    /api/boards/{id}/posts             → 게시글 목록
  GET    /api/posts/{id}                    → 게시글 상세

일정:
  GET    /api/schedules                     → 일정 목록
  GET    /api/schedules/{id}                → 일정 상세

주식 데이터:
  GET    /api/krx-data                      → KRX 시장 데이터
  GET    /api/krx-data/dates                → KRX 이용 가능 날짜
  GET    /api/fsc-stock-price               → FSC 주가
  GET    /api/fsc-stock-price/dates         → FSC 이용 가능 날짜

기타:
  GET    /api/collected-data                → 수집 데이터
  GET    /api/collected-data/{id}           → 데이터 상세
  GET    /api/main-page-config              → 페이지 레이아웃 설정
  GET    /api/naver-finance/limit-up        → 상한가 종목
  GET    /api/naver-finance/limit-down      → 하한가 종목
```

---

## 13. 데이터 동기화

### 13.1 실시간 데이터

- Yahoo Finance API를 통한 실시간 시장 지수
- 소셜 로그인 데이터 즉시 백엔드 동기화

### 13.2 관심종목 동기화

- Zustand (localStorage) + 백엔드 이중 저장
- 이벤트 시스템: `window.dispatchEvent(new Event('favoritesUpdated'))`

---

## 14. 프로젝트 요약

**주리니(Jurini)**는 한국 사용자를 위한 **모던 Next.js 16 주식 시장 정보 플랫폼**입니다.

### 주요 특징

- 관심사 분리가 잘 된 아키텍처 (서비스, 컴포넌트, 타입)
- 이중 데이터 소스 (개발용 목 데이터, 프로덕션 실제 API)
- OAuth2 인증 (Google, Naver)
- 모바일 퍼스트 반응형 디자인 (Bottom Nav 패턴)
- Zustand 전역 상태 관리
- TypeScript 완전 타입 지원
- 프로덕션 수준 에러 핸들링 및 폴백
- 메모이제이션 및 커스텀 훅을 통한 성능 최적화

---

*문서 생성일: 2026-01-27*
