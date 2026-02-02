# Stock BO - 프로젝트 문서

> 주식 정보 관리 시스템 (Stock Back Office)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [데이터베이스 구조](#4-데이터베이스-구조)
5. [API 명세](#5-api-명세)
6. [인증 시스템](#6-인증-시스템)
7. [배포 설정](#7-배포-설정)

---

## 1. 프로젝트 개요

Stock BO는 주식 정보 관리 및 커뮤니티 시스템입니다. 관리자 백오피스와 프론트엔드 API를 통합 제공합니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| **회원 관리** | 소셜 로그인 (Google, Naver), 관심종목, 프로필 관리 |
| **게시판** | 게시판 CRUD, 댓글, 파일 첨부 |
| **일정 관리** | 수동 일정 + 공공데이터 API 연동 |
| **금융 데이터** | 한국거래소(KRX), 금융위원회(FSC) 데이터 수집 |
| **메인 페이지 관리** | 배너, 항목 노출/순서 관리, 반복 설정 |
| **프로필 설정** | 캐릭터, 주식 단어 관리 (자동 닉네임 생성) |

---

## 2. 기술 스택

### 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| **Python** | 3.12 | 프로그래밍 언어 |
| **FastAPI** | 0.127.0 | REST API 프레임워크 |
| **Uvicorn** | 0.40.0 | ASGI 웹 서버 |
| **SQLAlchemy** | 2.0.45 | ORM |
| **PyMySQL** | 1.1.2 | MySQL 드라이버 |
| **Pydantic** | 2.12.5 | 데이터 검증 |

### 인증 및 보안

| 기술 | 용도 |
|------|------|
| **python-jose** | JWT 토큰 생성/검증 |
| **bcrypt** | 비밀번호 암호화 |
| **passlib** | 패스워드 해싱 |

### 프론트엔드

| 기술 | 용도 |
|------|------|
| **Jinja2** | HTML 템플릿 엔진 (SSR) |
| **JavaScript** | 클라이언트 로직 |

### 인프라

| 기술 | 용도 |
|------|------|
| **MySQL 8.0** | 데이터베이스 |
| **Nginx** | 웹 서버 / 리버스 프록시 |
| **Docker** | 컨테이너화 |

---

## 3. 프로젝트 구조

```
stock-bo/
├── app/                          # 메인 애플리케이션
│   ├── main.py                   # FastAPI 진입점
│   ├── config.py                 # 설정 관리
│   ├── database.py               # DB 연결 설정
│   ├── models.py                 # SQLAlchemy 모델 (13개 테이블)
│   ├── dependencies.py           # 의존성 주입 (인증)
│   │
│   ├── routers/                  # API 라우터
│   │   ├── auth.py               # 인증 (로그인, 소셜로그인)
│   │   ├── admin.py              # 관리자 관리
│   │   ├── members.py            # 회원 관리
│   │   ├── board.py              # 게시판
│   │   ├── dashboard.py          # 대시보드
│   │   ├── schedule.py           # 일정 관리
│   │   ├── finance.py            # KRX 데이터
│   │   ├── fsc.py                # FSC 데이터
│   │   ├── api.py                # REST API (프론트엔드용)
│   │   └── profile.py            # 프로필 설정
│   │
│   ├── services/                 # 비즈니스 로직
│   │   ├── api_service.py        # API 데이터 처리
│   │   ├── scheduler_service.py  # 스케줄러
│   │   └── schedule_api_service.py
│   │
│   ├── utils/                    # 유틸리티
│   │   └── profile_generator.py  # 프로필 생성
│   │
│   └── migrations/               # DB 마이그레이션 (11개)
│
├── templates/                    # Jinja2 템플릿 (22개)
│   ├── base.html                 # 기본 레이아웃
│   ├── sidebar.html              # 사이드바
│   ├── dashboard.html            # 대시보드
│   ├── admin_*.html              # 관리자 페이지들
│   ├── board_*.html              # 게시판 페이지들
│   └── ...
│
├── static/                       # 정적 파일
│   ├── js/                       # JavaScript
│   └── image/                    # 이미지 리소스
│
├── uploads/                      # 업로드 파일
│   ├── images/                   # 이미지
│   ├── files/                    # 문서
│   └── banners/                  # 배너
│
├── Dockerfile                    # Docker 이미지
├── docker-compose.yml            # Docker Compose
├── nginx.conf                    # Nginx 설정
├── requirements.txt              # Python 의존성
└── .env                          # 환경 변수
```

---

## 4. 데이터베이스 구조

### 4.1 ER 다이어그램

```
┌─────────────────┐     ┌─────────────────┐
│   admin_users   │────<│  refresh_tokens │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│     boards      │────<│      posts      │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│    members      │     │   schedules     │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│    krx_data     │     │ fsc_stock_price │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   characters    │     │   stock_words   │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ main_page_items │     │     banners     │
└─────────────────┘     └─────────────────┘

┌─────────────────┐
│ collected_data  │
└─────────────────┘
```

### 4.2 테이블 상세

#### admin_users (관리자)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| email | String(100), Unique | 이메일 |
| name | String(50) | 이름 |
| hashed_password | String(255) | 암호화된 비밀번호 |
| created_at | DateTime | 생성일시 |

#### members (회원)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| email | String(100), Unique | 이메일 |
| name | String(50) | 이름 |
| nickname | String(50), Nullable | 닉네임 |
| profile_image | String(500), Nullable | 프로필 이미지 URL |
| provider | String(20) | 소셜 제공자 (google/naver) |
| provider_id | String(255) | 소셜 ID |
| status | String(20) | 상태 (active/blocked) |
| favorite_stocks | Text, Nullable | 관심종목 (JSON) |
| created_at | DateTime | 가입일시 |
| updated_at | DateTime | 수정일시 |

#### refresh_tokens (JWT 리프레시 토큰)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| token | String(255), Unique | 토큰 |
| user_id | Integer, FK | 관리자 ID |
| expires_at | DateTime | 만료일시 |
| created_at | DateTime | 생성일시 |
| last_used_at | DateTime | 마지막 사용일시 |

#### boards (게시판)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | String(20), PK | 게시판 ID (B001, B002...) |
| name | String(100) | 게시판 이름 |
| type | String(20) | 타입 (korean/guestbook) |
| auth | String(20) | 접근권한 (all/member/admin) |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### posts (게시글)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| board_id | String(20), FK | 게시판 ID |
| title | String(255) | 제목 |
| content | Text | 내용 (HTML) |
| author | String(100) | 작성자 |
| views | Integer | 조회수 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### schedules (일정)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| date | Date | 일정 날짜 |
| subject | String(255) | 제목 |
| content | String(500) | 내용 |
| type | String(20) | 타입 (manual/api) |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### krx_data (한국거래소 데이터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| data_type | String(20) | 타입 (kospi/kosdaq/market) |
| bas_dd | String(8) | 기준일자 (YYYYMMDD) |
| data | Text | JSON 데이터 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

**Unique 제약조건:** (data_type, bas_dd)

#### fsc_stock_price (금융위원회 주식시세)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| bas_dt | String(8) | 기준일자 |
| srtn_cd | String(10) | 종목코드 |
| isin_cd | String(12) | ISIN코드 |
| itms_nm | String(100) | 종목명 |
| mrkt_ctg | String(20) | 시장구분 |
| clpr | String(20) | 종가 |
| vs | String(20) | 대비 |
| flt_rt | String(20) | 등락율 |
| mkp | String(20) | 시가 |
| hipr | String(20) | 고가 |
| lopr | String(20) | 저가 |
| trqu | String(20) | 거래량 |
| tr_prc | String(20) | 거래대금 |
| lstg_st_cnt | String(20) | 상장주식수 |
| mrkt_tot_amt | String(30) | 시가총액 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

**Unique 제약조건:** (bas_dt, srtn_cd)

#### characters (캐릭터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| name | String(50) | 캐릭터 이름 |
| image_url | String(500) | 이미지 URL |
| order_index | Integer | 정렬 순서 |
| is_active | String(20) | 활성화 여부 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### stock_words (주식 단어)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| word | String(50), Unique | 단어 |
| order_index | Integer | 정렬 순서 |
| is_active | String(20) | 활성화 여부 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### main_page_items (메인 페이지 항목)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| name | String(50), Unique | 항목 이름 |
| component_key | String(50), Unique | 컴포넌트 키 |
| order_index | Integer | 노출 순서 |
| is_visible | String(20) | 노출 여부 (visible/hidden) |
| start_date | String(16), Nullable | 노출 시작일시 |
| end_date | String(16), Nullable | 노출 종료일시 |
| repeat_type | String(20) | 반복 타입 (none/daily/weekly) |
| repeat_days | String(20), Nullable | 주간 반복 요일 |
| repeat_start_time | String(5), Nullable | 반복 시작 시간 |
| repeat_end_time | String(5), Nullable | 반복 종료 시간 |
| repeat_next_day | String(5) | 익일까지 반복 여부 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### banners (배너)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| type | String(20) | 타입 (top_banner/banner) |
| image_url | String(500) | 이미지 URL |
| link_url | String(500), Nullable | 링크 URL |
| alt_text | String(200), Nullable | 대체 텍스트 |
| order_index | Integer | 정렬 순서 |
| is_active | String(20) | 활성화 여부 |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

#### collected_data (수집 데이터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer, PK | 고유 ID |
| type | String(50) | 데이터 타입 |
| status | String(20) | 상태 (success/failed) |
| message | String(255) | 메시지 |
| created_at | DateTime | 생성일시 |

---

## 5. API 명세

### 5.1 인증 API

#### 관리자 로그인 (JWT 토큰 발급)

```
POST /api/auth/token
Content-Type: application/json

{
  "username": "admin@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh-token...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_expires_in": 2592000
}
```

#### 소셜 로그인

```
POST /api/auth/social-login
Content-Type: application/json

{
  "provider": "google",
  "email": "user@example.com",
  "name": "홍길동",
  "provider_id": "1234567890"
}
```

**응답:**
```json
{
  "success": true,
  "message": "회원 정보가 저장되었습니다.",
  "member_id": 1,
  "has_nickname": false,
  "nickname": null,
  "profile_image": "/path/to/image.jpg"
}
```

### 5.2 회원 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/auth/member/info` | 회원 정보 조회 | Query param |
| PUT | `/api/auth/member/update` | 회원 정보 수정 | - |
| GET | `/api/auth/member/favorites` | 관심종목 조회 | Query param |
| POST | `/api/auth/member/favorites` | 관심종목 추가 | - |
| DELETE | `/api/auth/member/favorites` | 관심종목 삭제 | - |
| DELETE | `/api/auth/member/withdraw` | 회원 탈퇴 | Query param |

### 5.3 게시판 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/boards` | 게시판 목록 | API Key |
| GET | `/api/boards/{board_id}` | 게시판 상세 | API Key |
| GET | `/api/boards/{board_id}/posts` | 게시글 목록 | API Key |
| GET | `/api/posts/{post_id}` | 게시글 상세 | API Key |

**Query Parameters:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 10)

### 5.4 일정 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/schedules` | 일정 목록 | API Key |
| GET | `/api/schedules/{schedule_id}` | 일정 상세 | API Key |

**Query Parameters:**
- `start_date`: 시작 날짜 (YYYY-MM-DD)
- `end_date`: 종료 날짜 (YYYY-MM-DD)

### 5.5 금융 데이터 API

#### KRX 데이터

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/krx-data` | KRX 데이터 조회 | API Key |
| GET | `/api/krx-data/dates` | 날짜 목록 | API Key |

**Query Parameters:**
- `data_type`: 데이터 타입 (kospi/kosdaq/market)
- `bas_dd`: 기준일자 (YYYYMMDD)

#### FSC 데이터

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/fsc-stock-price` | 주식시세정보 | API Key |
| GET | `/api/fsc-stock-price/dates` | 날짜 목록 | API Key |

**Query Parameters:**
- `bas_dt`: 기준일자 (YYYYMMDD)

### 5.6 메인 페이지 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/main-page-config` | 메인 페이지 설정 | 없음 |
| GET | `/api/banners` | 배너 목록 | API Key |

**Query Parameters (banners):**
- `type`: 배너 타입 (top_banner/banner)

### 5.7 해외지수 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/foreign-indices` | 해외지수 조회 | API Key |

**응답 (12개 지수):**
- S&P 500, Dow Jones, Nasdaq, VIX
- 니케이225, 상해종합, 항셍
- FTSE 100, DAX, CAC 40
- WTI 원유, 금

### 5.8 프로필 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/auth/characters` | 캐릭터 목록 | 없음 |
| GET | `/api/auth/stock-words` | 주식 단어 목록 | 없음 |
| GET | `/api/auth/generate-nickname` | 닉네임 생성 | 없음 |

---

## 6. 인증 시스템

### 6.1 인증 방식

| 방식 | 설명 | 사용처 |
|------|------|--------|
| **쿠키 기반** | `bo_session_id` 쿠키 | 관리자 웹 페이지 |
| **JWT Token** | Authorization 헤더 | REST API (관리자) |
| **API Key** | X-API-KEY 헤더 | 프론트엔드 API |

### 6.2 쿠키 인증

```
Cookie: bo_session_id={SECRET_TOKEN}
```

- **쿠키 이름:** `bo_session_id`
- **설정:** `httponly=True`
- **사용처:** `/admin/*` 경로

### 6.3 JWT 토큰

```
Authorization: Bearer {access_token}
```

- **Access Token 유효기간:** 환경변수 `JWT_ACCESS_TOKEN_EXPIRE_HOURS`
- **Refresh Token 유효기간:** 환경변수 `JWT_REFRESH_TOKEN_EXPIRE_DAYS`

### 6.4 API Key

```
X-API-KEY: 1978022019820308200705092018111420220303
```

- **API Key:** 고정값
- **사용처:** 프론트엔드 앱에서 호출

---

## 7. 배포 설정

### 7.1 Docker Compose 구성

```yaml
services:
  db:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: stock_bo

  web:
    build: .
    ports:
      - "8080:8080"
    depends_on:
      - db

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - web
```

### 7.2 환경 변수 (.env)

```env
# 관리자 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_password
ADMIN_NAME=관리자

# 데이터베이스
DB_USER=root
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=stock_bo

# 인증
SECRET_TOKEN=your_secret_token
JWT_SECRET_KEY=your_jwt_secret
JWT_ACCESS_TOKEN_EXPIRE_HOURS=1
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# API
API_AUTH_KEY=your_api_key
```

### 7.3 Nginx 설정

```nginx
server {
    listen 80;

    location / {
        proxy_pass http://web:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static {
        alias /app/static;
    }

    location /uploads {
        alias /app/uploads;
    }
}
```

### 7.4 실행 방법

```bash
# Docker Compose 실행
docker-compose up -d

# 또는 직접 실행
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

---

## 부록: 관리자 페이지 목록

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/admin/dashboard` | 대시보드 | 통계 및 현황 |
| `/admin/users` | 관리자 관리 | 관리자 추가/삭제 |
| `/admin/members` | 회원 관리 | 회원 목록/상태 변경 |
| `/admin/main` | 메인 페이지 설정 | 항목 노출/순서 관리 |
| `/admin/banners/{type}` | 배너 관리 | 배너 추가/수정/삭제 |
| `/admin/board` | 게시판 관리 | 게시판 CRUD |
| `/admin/board/{id}/posts` | 게시글 관리 | 게시글 목록/관리 |
| `/admin/schedule` | 일정 관리 | 일정 추가/수정/삭제 |
| `/admin/finance-data` | KRX 데이터 | 한국거래소 데이터 |
| `/admin/finance-data2` | FSC 데이터 | 금융위원회 데이터 |
| `/admin/profile` | 프로필 설정 | 캐릭터/주식단어 관리 |
| `/admin/settings` | 설정 | 시스템 설정 |

---

**문서 버전:** 1.0
**최종 업데이트:** 2026-01-27
