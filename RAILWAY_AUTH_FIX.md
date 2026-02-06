# Railway 배포 인증 오류 해결 가이드

## 🔍 문제 분석

Railway 배포 후 인증 오류가 발생하는 주요 원인:

### 0. 코드 레벨 문제 (수정 완료) ⚠️

**발견된 문제:**
- `apps/admin/app/routers/api.py`에서 **하드코딩된 API 키**를 사용하고 있었음
- `API_ACCESS_KEY = "1978022019820308200705092018111420220303"` (하드코딩)
- 다른 라우터(`board.py`, `stock_terms.py`)는 환경 변수(`NEXT_PUBLIC_X_API_KEY`)를 사용
- 결과: Railway에서 환경 변수를 변경해도 `api.py`의 라우터들은 여전히 하드코딩된 값을 기대하여 인증 실패

**수정 내용:**
- `api.py`의 `verify_api_key` 함수를 `dependencies.py`의 것을 사용하도록 변경
- 모든 라우터가 환경 변수(`NEXT_PUBLIC_X_API_KEY`)를 일관되게 사용하도록 수정

### 1. 환경 변수 불일치 문제

**문제점:**
- Admin 앱(`apps/admin`)과 Web 앱(`apps/web`)이 **독립적으로 배포**됨
- 두 서비스가 **같은 환경 변수 값**을 사용해야 하는데, Railway에서 각각 설정해야 함
- 특히 `NEXT_PUBLIC_X_API_KEY`가 두 서비스에서 **정확히 일치**해야 함

**인증 흐름:**
```
Web 앱 → API 호출 시 X-API-KEY 헤더 전송
  ↓
Admin 앱 → X-API-KEY 헤더 검증
  ↓
일치하면 인증 성공, 불일치하면 401 오류
```

### 2. 루트 .env.local 접근 불가

**문제점:**
- 로컬 개발 시: 루트의 `.env.local` 파일을 두 앱이 공유
- Railway 배포 시: 각 서비스는 **독립적인 컨테이너**에서 실행
- Root Directory가 `apps/admin` 또는 `apps/web`으로 설정되면, 루트의 `.env.local`에 접근 불가
- **Railway Variables**에서 환경 변수를 직접 설정해야 함

### 3. packages/scripts 폴더 문제

**분석 결과:**
- `packages/database`: Prisma 스키마가 있지만, Admin 앱은 SQLAlchemy를 직접 사용하므로 **사용되지 않음**
- `packages/ui`: 공통 UI 컴포넌트이지만, 현재 사용되지 않는 것으로 보임
- `scripts/`: 루트에 있지만, Admin 앱 실행 시 필요하지 않음

**결론:** `packages/` 또는 `scripts/` 폴더가 없어서 인증 오류가 발생하는 것은 **아님**. 문제는 **환경 변수 설정**입니다.

---

## ✅ 해결 방법

### 1. Railway 환경 변수 설정 (필수)

Railway 대시보드에서 **각 서비스**에 다음 환경 변수를 설정하세요:

#### Admin 서비스 (`apps/admin`)

**Railway → Admin 서비스 → Variables** 탭에서 설정:

| 변수명 | 필수 | 설명 | 예시 값 |
|--------|------|------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 URL (Railway PostgreSQL 추가 시 자동 생성) | `postgresql://user:pass@host:port/db?sslmode=require` |
| `ADMIN_EMAIL` | ✅ | 초기 관리자 이메일 | `admin@example.com` |
| `ADMIN_PW` | ✅ | 초기 관리자 비밀번호 | `your-secure-password` |
| `SECRET_TOKEN` | ✅ | 세션 인증 토큰 (강력한 랜덤 문자열) | `openssl rand -base64 32`로 생성 |
| `NEXT_PUBLIC_X_API_KEY` | ✅ | **Web과 동일한 값** (API 인증 키) | `1978022019820308200705092018111420220303` |
| `JWT_SECRET_KEY` | 선택 | JWT 토큰 암호화 키 (없으면 SECRET_TOKEN 사용) | `openssl rand -base64 32`로 생성 |
| `DATA_GO_KR_API_KEY` | 선택 | 공공데이터포털 API 키 | (필요 시) |

**중요:** `NEXT_PUBLIC_X_API_KEY`는 **Web 서비스와 정확히 동일한 값**이어야 합니다!

#### Web 서비스 (`apps/web`)

**Railway → Web 서비스 → Variables** 탭에서 설정:

| 변수명 | 필수 | 설명 | 예시 값 |
|--------|------|------|---------|
| `NEXTAUTH_URL` | ✅ | **실제 배포 URL** (localhost 사용 금지!) | `https://your-web-service.up.railway.app` |
| `NEXTAUTH_SECRET` | ✅ | NextAuth 세션 암호화 키 (32자 이상) | `openssl rand -base64 32`로 생성 |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | Admin 서비스 Railway URL | `https://your-admin-service.up.railway.app` |
| `NEXT_PUBLIC_X_API_KEY` | ✅ | **Admin과 동일한 값** (API 인증 키) | `1978022019820308200705092018111420220303` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 선택 | Google OAuth 클라이언트 ID | (소셜 로그인 시) |
| `GOOGLE_CLIENT_SECRET` | 선택 | Google OAuth Secret | (소셜 로그인 시) |
| `NAVER_CLIENT_LOGIN_ID` | 선택 | Naver OAuth 클라이언트 ID | (소셜 로그인 시) |
| `NAVER_CLIENT_LOGIN_SECRET` | 선택 | Naver OAuth Secret | (소셜 로그인 시) |

**중요:** 
- `NEXT_PUBLIC_X_API_KEY`는 **Admin 서비스와 정확히 동일한 값**이어야 합니다!
- `NEXTAUTH_URL`은 **절대 localhost를 사용하지 마세요**. Railway가 제공하는 실제 도메인을 사용하세요.

---

### 2. 환경 변수 생성 방법

#### SECRET_TOKEN / NEXTAUTH_SECRET / JWT_SECRET_KEY 생성

터미널에서 다음 명령어 실행:

```bash
openssl rand -base64 32
```

출력된 값을 복사하여 Railway Variables에 설정하세요.

#### NEXT_PUBLIC_X_API_KEY 설정

**Web과 Admin이 동일한 값**을 사용해야 합니다. 예시:

```
1978022019820308200705092018111420220303
```

또는 새로운 키를 생성하려면:

```bash
# Python으로 생성
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# 또는 Node.js로 생성
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### 3. Railway 배포 설정 확인

#### Admin 서비스 설정

**Railway → Admin 서비스 → Settings** 탭에서 확인:

- **Root Directory**: `apps/admin` ✅
- **Build Command**: (자동 감지 또는 비워둠)
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` ✅

#### Web 서비스 설정

**Railway → Web 서비스 → Settings** 탭에서 확인:

- **Root Directory**: `apps/web` ✅
- **Build Command**: (자동 감지 또는 비워둠)
- **Start Command**: `npx next start -p $PORT` ✅

---

### 4. 배포 후 확인 사항

#### 1) Admin 서비스 확인

1. Railway → Admin 서비스 → Deployments → 최신 배포 로그 확인
2. 다음 메시지가 출력되는지 확인:
   - ✅ `데이터베이스 테이블 생성 완료`
   - ✅ `초기 관리자 생성 완료`
   - ✅ `애플리케이션 시작`

3. Admin Swagger 문서 접속:
   ```
   https://your-admin-service.up.railway.app/docs
   ```
   - 200 응답이 나오면 정상

#### 2) Web 서비스 확인

1. Railway → Web 서비스 → Deployments → 최신 배포 로그 확인
2. 빌드 및 시작 로그 확인

3. Web 메인 페이지 접속:
   ```
   https://your-web-service.up.railway.app
   ```
   - 페이지가 정상적으로 로드되면 성공
   - 계속 로딩만 되고 `CLIENT_FETCH_ERROR`가 나오면 `NEXTAUTH_URL` 또는 `NEXTAUTH_SECRET` 확인

#### 3) 인증 테스트

1. Web 앱에서 API 호출 시도 (예: 메인 페이지 로드)
2. 브라우저 개발자 도구 → Network 탭 확인
3. Admin API 호출 시:
   - **200 응답**: 인증 성공 ✅
   - **401 응답**: `NEXT_PUBLIC_X_API_KEY` 불일치 확인 ❌
   - **502 응답**: Admin 서비스 다운 또는 시작 중 확인

---

## 🔧 추가 문제 해결

### 문제 1: 401 "Not authenticated" 오류

**원인:** `NEXT_PUBLIC_X_API_KEY`가 Web과 Admin에서 다름

**해결:**
1. Railway → Admin 서비스 → Variables → `NEXT_PUBLIC_X_API_KEY` 값 확인
2. Railway → Web 서비스 → Variables → `NEXT_PUBLIC_X_API_KEY` 값 확인
3. **두 값이 정확히 일치하는지** 확인 (공백, 대소문자 주의)
4. 일치하지 않으면 동일한 값으로 수정
5. 두 서비스 모두 **Redeploy**

### 문제 2: CLIENT_FETCH_ERROR / /api/auth/session 오류

**원인:** `NEXTAUTH_URL` 또는 `NEXTAUTH_SECRET` 미설정/잘못 설정

**해결:**
1. Railway → Web 서비스 → Variables 확인
2. `NEXTAUTH_URL`이 **실제 배포 URL**인지 확인 (localhost 아님)
3. `NEXTAUTH_SECRET`이 설정되어 있는지 확인 (32자 이상)
4. 설정 후 **Redeploy**

### 문제 3: 502 "Application failed to respond"

**원인:** Admin 서비스가 시작되지 않음 또는 DB 연결 실패

**해결:**
1. Railway → Admin 서비스 → Deployments → 로그 확인
2. `DATABASE_URL`이 올바른지 확인
3. PostgreSQL 서비스가 실행 중인지 확인
4. 필요 시 Admin 서비스 **Redeploy**

---

## 📋 체크리스트

배포 전 확인:

- [ ] Railway PostgreSQL 추가 및 `DATABASE_URL` 확인
- [ ] Admin 서비스 Variables 설정:
  - [ ] `DATABASE_URL`
  - [ ] `ADMIN_EMAIL`
  - [ ] `ADMIN_PW`
  - [ ] `SECRET_TOKEN`
  - [ ] `NEXT_PUBLIC_X_API_KEY` (Web과 동일)
- [ ] Web 서비스 Variables 설정:
  - [ ] `NEXTAUTH_URL` (실제 배포 URL)
  - [ ] `NEXTAUTH_SECRET` (32자 이상)
  - [ ] `NEXT_PUBLIC_API_BASE_URL` (Admin 서비스 URL)
  - [ ] `NEXT_PUBLIC_X_API_KEY` (Admin과 동일)
- [ ] 두 서비스 모두 배포 완료
- [ ] Admin Swagger 문서 접속 확인 (`/docs`)
- [ ] Web 메인 페이지 접속 확인
- [ ] API 호출 시 401 오류 없는지 확인

---

## 💡 요약

**핵심 문제:**
- Railway에서 Web과 Admin이 **독립적으로 배포**되므로, 환경 변수를 각각 설정해야 함
- `NEXT_PUBLIC_X_API_KEY`가 **두 서비스에서 정확히 일치**해야 인증 성공
- 루트의 `.env.local`은 Railway에서 사용되지 않음 → **Railway Variables에서 직접 설정**

**해결책:**
1. Railway Variables에서 각 서비스에 환경 변수 설정
2. `NEXT_PUBLIC_X_API_KEY`를 Web과 Admin에서 **동일한 값**으로 설정
3. `NEXTAUTH_URL`을 실제 배포 URL로 설정 (localhost 금지)
4. 배포 후 로그 및 API 응답 확인

**packages/scripts 폴더는 문제와 무관합니다.** 인증 오류는 환경 변수 설정 문제입니다.

