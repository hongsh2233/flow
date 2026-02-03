# 환경 변수 설정 가이드

## 📋 개요

이 프로젝트는 루트 디렉토리의 `.env.local` 파일을 사용하여 web과 admin 앱이 공유하는 환경 변수를 관리합니다.

## 🔧 필수 설정

### 1. `.env.local` 파일 생성

프로젝트 루트 디렉토리(`/Users/hongsungho/Jurin-i/`)에 `.env.local` 파일을 생성하세요.

```bash
cd /Users/hongsungho/Jurin-i
touch .env.local
```

### 2. 필수 환경 변수 설정

admin 앱이 실행되기 위해 **반드시** 다음 환경 변수들이 설정되어야 합니다:

#### 데이터베이스 설정 (PostgreSQL)

```env
# 로컬 개발 환경 (docker-compose 사용 시)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo
DB_USER=postgres
DB_PASSWORD=postgres_password
```

또는 Railway/프로덕션 환경에서는:

```env
# DATABASE_URL 사용 (DB_* 변수 대신)
DATABASE_URL=postgresql+psycopg2://user:password@host:port/database?sslmode=require
```

#### Admin 인증 설정

```env
# 초기 관리자 계정 (서버 시작 시 자동 생성됨)
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your-secure-password

# 세션 인증 토큰 (보안을 위해 강력한 랜덤 문자열 사용)
SECRET_TOKEN=your-secret-token-here
```

#### Web과 Admin 공유 설정

```env
# 백오피스 API 기본 URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

# API 인증 키 (web과 admin이 동일한 값 사용)
NEXT_PUBLIC_X_API_KEY=1978022019820308200705092018111420220303
```

### 3. 선택적 환경 변수

```env
# JWT 토큰 암호화 키 (기본값: SECRET_TOKEN 사용)
JWT_SECRET_KEY=your-jwt-secret-key

# 인증 쿠키 이름 (기본값: bo_session_id)
AUTH_COOKIE_NAME=bo_session_id

# 공공데이터포털 API 키 (금융위원회, 한국거래소 데이터 사용 시)
DATA_GO_KR_API_KEY=your-data-go-kr-api-key
```

## ✅ 검증 방법

### 방법 1: 검증 스크립트 사용

```bash
cd /Users/hongsungho/Jurin-i
python3 check-env.py
```

### 방법 2: Admin 서버 실행으로 확인

```bash
cd /Users/hongsungho/Jurin-i/apps/admin
source venv/bin/activate  # 또는 .\venv\Scripts\activate (Windows)
uvicorn app.main:app --reload --port 8080
```

서버 시작 시 다음 메시지들을 확인하세요:

- ✅ `.env.local 로드 완료 (루트): /Users/hongsungho/Jurin-i/.env.local`
- ✅ `데이터베이스 테이블 생성 완료`
- ✅ `초기 관리자 생성 완료`

만약 다음 경고가 나타나면 환경 변수가 누락된 것입니다:

- ❌ `경고: .env.local(루트) 또는 .env(admin) 없음`
- ❌ `데이터베이스 연결 실패`
- ❌ `초기 관리자 생성 실패`

## 📝 전체 예시 파일

```env
# ============================================
# 데이터베이스 설정 (PostgreSQL)
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo
DB_USER=postgres
DB_PASSWORD=postgres_password

# ============================================
# Admin (백오피스) 인증 설정
# ============================================
ADMIN_EMAIL=admin@example.com
ADMIN_PW=admin123!@#
SECRET_TOKEN=your-secret-token-change-this-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-this-in-production

# ============================================
# Web (프론트엔드) 설정
# ============================================
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_X_API_KEY=1978022019820308200705092018111420220303

# ============================================
# 공공데이터포털 API (선택사항)
# ============================================
# DATA_GO_KR_API_KEY=your-data-go-kr-api-key
```

## 🔒 보안 주의사항

1. **`.env.local` 파일은 절대 Git에 커밋하지 마세요** (이미 `.gitignore`에 포함됨)
2. 프로덕션 환경에서는 다음 값들을 반드시 변경하세요:
   - `SECRET_TOKEN`: 강력한 랜덤 문자열
   - `ADMIN_PW`: 복잡한 비밀번호 (최소 8자 이상)
   - `DB_PASSWORD`: 기본값(`postgres_password`) 사용 금지
3. Railway 등 프로덕션 환경에서는 환경 변수를 Railway 대시보드에서 설정하세요.

## 🚀 다음 단계

환경 변수 설정이 완료되면:

1. **PostgreSQL 데이터베이스 실행**
   ```bash
   cd apps/admin
   docker-compose up -d
   ```

2. **Admin 서버 실행**
   ```bash
   cd apps/admin
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8080
   ```

3. **브라우저에서 확인**
   - Admin UI: http://localhost:8080
   - API 문서: http://localhost:8080/docs

