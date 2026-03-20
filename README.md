# 플로우 (Jurin-i) — 초보 투자자를 위한 주식 앱

Next.js 웹앱 + Python FastAPI 백엔드의 모노레포 구조.
Android APK(Capacitor), 웹 브라우저 모두 지원.

---

## 프로젝트 구조

```
jurin-i/
├── apps/
│   ├── web_new/          # Next.js 프론트엔드 (사용자 앱)
│   └── admin/            # Python FastAPI 백엔드 (백오피스)
├── packages/
│   ├── database/         # Prisma 스키마 (공유 DB 정의)
│   └── ui/               # 공통 UI 컴포넌트
└── .env.local            # 공유 환경 변수 (gitignore)
```

### 프론트엔드 (`apps/web_new`)

```
app/
├── page.tsx                        # 홈 화면
├── login/page.tsx                  # 로그인
├── signup/page.tsx                 # 회원가입
├── briefing/page.tsx               # 브리핑 (뉴스·시황)
├── calendar/page.tsx               # 일정 캘린더
├── market/page.tsx                 # 마켓 (종목 검색)
├── stock-chat/page.tsx             # 주톡 (대가 한마디)
├── settings/page.tsx               # 설정
├── board/[id]/page.tsx             # 게시글 상세
├── report/[id]/page.tsx            # 리포트 상세
├── auth/mobile-callback/page.tsx   # 모바일 OAuth 콜백 (Capacitor용)
├── api/                            # Next.js API Routes
│   ├── auth/[...nextauth]/         # NextAuth 핸들러
│   ├── auth/get-oauth-url/[provider]/ # 모바일 OAuth URL 획득
│   ├── main-posts/                 # 메인 노출 게시글
│   ├── banners/managed/            # 관리 배너
│   ├── schedules/                  # 일정
│   └── notifications/              # 알림
└── components/
    ├── layout/                     # Header, BottomNavigation, LayoutShell
    ├── module/home/                # 홈 화면 모듈 컴포넌트
    ├── providers/                  # CapacitorProvider (FCM 푸시)
    └── ui/                         # 공통 UI 컴포넌트
lib/
├── config/api.ts                   # API 엔드포인트 설정
├── hooks/                          # 커스텀 훅
├── services/                       # API 서비스 레이어
├── stores/                         # Zustand 상태관리
└── types/                          # TypeScript 타입 정의
```

### 백엔드 (`apps/admin`)

```
app/
├── main.py           # FastAPI 앱 진입점
├── models.py         # SQLAlchemy 모델
├── config.py         # 환경 설정
├── dependencies.py   # 공통 의존성 (인증 등)
└── routers/
    ├── auth.py       # 인증 (로그인, 회원가입, 소셜로그인)
    ├── board.py      # 게시판·게시글
    ├── schedule.py   # 일정 캘린더
    ├── api.py        # 주식 데이터 API
    ├── notification.py # 알림
    └── fcm.py        # FCM 푸시 알림
engine/               # 스케줄러 (데이터 수집 자동화)
dashboard/            # 관리자 대시보드 UI
```

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 홈 화면 | 투데이 이슈(최대 3개), 시장 지수, 투자자 동향, 관심 종목 |
| 주BTI 테스트 | 투자 성향 진단 (공격형/방어형/분석형/직관형) → 대가 매칭 |
| 브리핑 | 국내외 뉴스 + 시황 통합 피드 |
| 캘린더 | 실적발표·배당락·IPO 등 주요 주식 일정 |
| 마켓 | 시총 상위 종목, 실시간 검색, 종목 상세 |
| 주톡 | 투자 대가들의 명언 피드 |
| 소셜 로그인 | Google·Naver OAuth (웹 + Capacitor 앱) |
| 푸시 알림 | FCM 기반 (Capacitor APK + JurinApp WebView) |

---

## 로컬 개발 환경 설정

상세 실행 방법: **RUN.md** 참고

### 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 생성:

```env
# ── 데이터베이스 ─────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo
DB_USER=postgres
DB_PASSWORD=postgres_password

# ── 백엔드 인증 ───────────────────────────────
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your-secure-password
SECRET_TOKEN=your-secret-token        # openssl rand -base64 32
JWT_SECRET_KEY=your-jwt-secret-key    # openssl rand -base64 32

# ── 프론트엔드 ────────────────────────────────
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_X_API_KEY=your-api-key    # admin과 동일한 값

# ── NextAuth (소셜 로그인) ────────────────────
NEXTAUTH_SECRET=your-nextauth-secret  # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# ── OAuth 공급자 ──────────────────────────────
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx

# ── 공공데이터 API (선택) ─────────────────────
# DATA_GO_KR_API_KEY=your-key
```

### 2. 실행 순서

```bash
# 1) PostgreSQL 실행
cd apps/admin && docker-compose up -d

# 2) 백엔드 실행 (http://localhost:8080)
cd apps/admin
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# 3) 프론트엔드 실행 (http://localhost:3000)
cd apps/web_new
npm install
npm run dev
```

---

## Railway 배포

### 필수 환경 변수

**Admin 서비스**

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 URL |
| `ADMIN_EMAIL` | ✅ | 초기 관리자 이메일 |
| `ADMIN_PW` | ✅ | 초기 관리자 비밀번호 |
| `SECRET_TOKEN` | ✅ | 세션 토큰 |
| `NEXT_PUBLIC_X_API_KEY` | ✅ | API 인증 키 (Web과 동일) |

**Web 서비스**

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXTAUTH_URL` | ✅ | 실제 배포 URL (localhost 금지) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth 시크릿 |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | Admin 서비스 URL |
| `NEXT_PUBLIC_X_API_KEY` | ✅ | API 인증 키 (Admin과 동일) |
| `GOOGLE_CLIENT_ID` | 소셜 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 소셜 | Google OAuth Secret |
| `NAVER_CLIENT_ID` | 소셜 | Naver OAuth Client ID |
| `NAVER_CLIENT_SECRET` | 소셜 | Naver OAuth Secret |

> **중요:** `NEXT_PUBLIC_X_API_KEY`는 Web·Admin 양쪽에서 **정확히 동일한 값** 사용

---

## API 명세

### 인증

| 방법 | 설명 |
|------|------|
| `X-API-KEY` 헤더 | 서비스 간 API 인증 |
| `Authorization: Bearer <JWT>` | 회원 API 인증 |

### 인증 API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/auth/member/login` | 이메일 로그인 |
| POST | `/api/auth/member/signup` | 회원가입 |
| POST | `/api/auth/social-login` | 소셜 로그인 (google/naver) |
| POST | `/api/auth/member/reissue-token` | JWT 토큰 재발급 |
| POST | `/api/auth/member/withdraw` | 회원 탈퇴 |
| GET  | `/api/auth/member/me` | 내 정보 조회 |
| PUT  | `/api/auth/member/me` | 내 정보 수정 |
| GET  | `/api/auth/check-email` | 이메일 중복 확인 |

**소셜 로그인 요청**
```json
POST /api/auth/social-login
{
  "provider": "google",
  "email": "user@example.com",
  "name": "홍길동",
  "provider_id": "google_unique_id"
}
```

**소셜 로그인 응답**
```json
{
  "success": true,
  "member_id": 1,
  "nickname": "투자고수123",
  "profile_image": "https://...",
  "grade": "regular",
  "has_nickname": false,
  "access_token": "eyJ..."
}
```

### 게시판 API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET  | `/api/boards` | 게시판 목록 |
| GET  | `/api/boards/{id}` | 게시판 상세 |
| GET  | `/api/boards/{id}/posts` | 게시글 목록 (`?page=1&limit=10`) |
| GET  | `/api/posts/{id}` | 게시글 상세 |
| POST | `/api/boards/{id}/posts` | 게시글 작성 |
| GET  | `/api/main-posts` | 메인 노출 게시글 (`?limit=3`) |

### 일정 API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET  | `/api/schedules` | 일정 목록 (`?start_date&end_date&type`) |
| POST | `/api/schedules` | 일정 등록 |
| PUT  | `/api/schedules/{id}` | 일정 수정 |
| DELETE | `/api/schedules/{id}` | 일정 삭제 |
| POST | `/api/schedule-alarms` | 일정 알림 신청 |

### 주식 데이터 API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET  | `/api/stocks/search` | 종목 검색 (`?q=삼성`) |
| GET  | `/api/stocks/{code}` | 종목 상세 |
| GET  | `/api/market/indices` | 시장 지수 (KOSPI, KOSDAQ 등) |
| GET  | `/api/market/investor-trend` | 투자자별 매매 동향 |
| GET  | `/api/krx/data` | KRX 데이터 |
| GET  | `/api/fsc/stock-price` | FSC 주식 시세 |

### 알림 API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET  | `/api/notifications` | 알림 목록 |
| PUT  | `/api/notifications/{id}/read` | 알림 읽음 처리 |
| POST | `/api/fcm-token` | FCM 토큰 등록 |

---

## Capacitor 모바일 앱 (Android)

상세 빌드 가이드: **CAPACITOR_SETUP.md** 참고

```bash
cd apps/web_new

# 1) capacitor.config.ts에서 Railway URL 설정
#    server.url = "https://your-app.railway.app"

# 2) Android 플랫폼 추가
npx cap add android

# 3) google-services.json 배치 (FCM 사용 시)
cp ~/Downloads/google-services.json android/app/google-services.json

# 4) 동기화 및 빌드
npx cap sync android
npx cap open android   # Android Studio에서 APK 빌드
```

### 소셜 로그인 (Capacitor)

Google/Naver OAuth는 Android WebView를 차단하므로 Chrome Custom Tab으로 처리:
- 앱 내 `@capacitor/browser`로 OAuth 페이지 열기
- 인증 완료 후 `/auth/mobile-callback` 페이지에서 브라우저 닫기
- `appStateChange` 이벤트로 앱 복귀 감지 → 세션 갱신 후 홈 이동

---

## AI 데이터 파이프라인 (Gemini)

백엔드 스케줄러가 주기적으로 시장 데이터를 수집하고, Gemini AI로 요약·분석 콘텐츠를 자동 생성합니다.

### 수집 → 분석 흐름

```
[Yahoo Finance / Naver API / KRX]
         ↓ 수집 (APScheduler)
   [DB: 지수·환율·뉴스 저장]
         ↓
  [Gemini 2.5 Flash 요약]
         ↓
  [DB 저장 / 게시판 자동 포스팅]
```

### Gemini 서비스 목록

| 서비스 파일 | 실행 시각 (KST) | 설명 |
|------------|----------------|------|
| `market_morning_gemini_service.py` | 매일 06:35 | 미국·한국 지수·환율 기반 **모닝 브리핑** 생성 → `MarketMorningAiSummary` 저장 |
| `daily_issue_gemini_service.py` | 평일 08:40, 12:40, 19:40 | 당일 Naver 수집 뉴스를 3~5줄로 요약 → `daily_issue_summaries` 저장 |
| `market_closing_gemini_service.py` | 평일 15:50 | 장마감 후 코스피·코스닥·환율·투자자동향·상한가 종목을 분석해 **플로우Ai** 계정으로 B001 게시판에 자동 포스팅. 수급(순매수·순매도) 섹션은 DB 원본 데이터를 직접 렌더링해 AI 오류를 방지함 |
| `supply_summary_gemini_service.py` | 수급 수집 직후 (스케줄러와 동일 시각) | 코스피·코스닥 각각 `naver_supply_data`에서 추출한 투자자·프로그램 순매수 숫자를 Gemini로 2~3문장 요약 → `supply_summary_ai_summaries` (`SupplySummaryAi`) 저장 |
| `target_price_news_service.py` | 매일 08:30, 12:00 | 증권사 목표가 상향 뉴스를 Gemini로 가공해 B002 게시판에 자동 포스팅 |

### 수급 요약 카드 (웹 `web_new`)

홈과 `/supply` 상단 **수급 요약** UI는 클릭 이동 없이 같은 카드만 표시한다.

1. **수집**: `collect_naver_supply_data`가 `bizdate`·`collected_time`을 한 번 정한 뒤, 동일 값으로 `collect_investor_program_supply_data`에 넘겨 `naver_supply_data`에 저장하고, 이어서 `generate_and_save_supply_summary`로 같은 키로 AI 요약을 저장한다. (수집 행과 AI 행의 시각 레이블이 어긋나지 않게 한다.)
2. **조회 (관리자 API)**: 최신 스냅샷 숫자는 `GET /api/naver-supply-data`, 저장된 요약 문장은 `GET /api/supply-summary-ai` (`bizdate`, `collected_time`, `market=kospi|kosdaq`).
3. **조회 (웹 BFF)**: `web_new`의 `GET /api/supply-summary`가 위 네 종류의 시간별 수급 데이터를 모아 숫자를 파싱하고, 동일 `bizdate`·`collected_time`으로 AI 요약을 붙여 JSON으로 내려준다. 카드의 장중/마감 시간 라벨은 백엔드 `supply_summary_gemini_service._time_label_for_collected_time`과 맞춘다.

**수집 스케줄 (월~금, 공휴일 제외)**: 08:40, 09:10~15:40(30분 간격), 16:40~20:40(1시간 간격).

### 목표가 상향 뉴스 수집 시간 윈도우

| 슬롯 | 수집 범위 (KST) | 대상 리포트 |
|------|----------------|-------------|
| **08:30** | 전일 12:00 ~ 당일 08:30 | 전날 오후·저녁 리포트 |
| **12:00** | 당일 08:30 ~ 당일 12:00 | 장중 오전 리포트 |

### 데이터 수집 스케줄 (scheduler_service.py)

| 데이터 | 수집 주기 | 보관 기간 | 소스 |
|--------|----------|-----------|------|
| 코스피·코스닥 지수 | 평일 09:10~15:10 (30분 간격, 13회) + 15:40 | 7일 | Yahoo Finance (`^KS11`, `^KQ11`) |
| 해외 지수 | 평일 장전·장중 수회 | 7일 | Yahoo Finance (NASDAQ, S&P500, Dow 등) |
| 환율 | 평일 30분마다 | 최신 스냅샷 | Yahoo Finance (`KRW=X`, `JPYKRW=X`, `EURKRW=X`) |
| 금리 | on-demand (1시간 캐시) | - | Yahoo Finance (`^TNX`, `^FVX`, `^IRX`) |
| 주식 영향 뉴스 | 평일 08:30, 12:30, 19:30 | 2일 | Naver 뉴스 검색 API |
| 목표가 상향 뉴스 | 매일 08:30, 12:00 | - | Naver 뉴스 검색 API + Gemini 가공 |
| 네이버 수급 (투자자·프로그램 시간별) | 평일 08:40~15:40 30분 간격, 16:40~20:40 1시간 간격 | 주기 스케줄만으로는 일자 정리 없음; `collect_all_supply_data` 실행 시 5영업일치 초과분 삭제 | Naver 증권 → `naver_supply_data` |

### AI 환경 변수

| 변수 | 설명 |
|------|------|
| `GEMINI_API_KEY` | Google AI Studio에서 발급 (`gemini-2.5-flash` 사용) |

> **참고**: API 키 미설정 또는 AI 오류 시 해당 서비스는 스킵되고 앱은 정상 동작합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16, React 19, TypeScript |
| 인증 | NextAuth 4 (JWT + OAuth) |
| 상태관리 | Zustand |
| UI | Material-UI Icons, Lucide React |
| 모바일 | Capacitor 7 (Android) |
| 백엔드 | Python FastAPI |
| ORM | SQLAlchemy |
| 데이터베이스 | PostgreSQL |
| 스케줄러 | APScheduler |
| 배포 | Railway |
| 푸시 알림 | FCM (Firebase Cloud Messaging) |
