# Railway 502 / NextAuth 오류 해결 가이드

## 오류 요약

| 오류 | 원인 | 해결 |
|------|------|------|
| `CLIENT_FETCH_ERROR` / `/api/auth/session` / **FE가 뜨지 않고 계속 데이터 불러오기** | NEXTAUTH_URL 또는 NEXTAUTH_SECRET 미설정/잘못 설정 | 아래 "1. FE (Web) Railway 환경 변수" 반드시 설정 |
| `502 Application failed to respond` | BO(Admin) 서비스 미응답 또는 FE 서비스 문제 | 아래 체크리스트 확인 |
| 메인 페이지 설정/FSC 주식시세 502 | BO 서비스 다운 또는 연결 실패 | BO 서비스 상태 및 DB 연결 확인 |

### FE가 뜨지 않고 계속 로딩만 될 때 (client_fetch_error)

증상: 배포된 FE URL 접속 시 화면이 안 뜨고, 콘솔에 `client_fetch_error`, `There is a problem with the server configuration`, `/api/auth/session` 오류가 반복됩니다.

**원인**: Railway의 **Web(FE) 서비스**에 `NEXTAUTH_URL` 또는 `NEXTAUTH_SECRET`이 없거나, `NEXTAUTH_URL`이 `localhost`로 되어 있는 경우입니다.

**해결 순서**:
1. Railway 대시보드 → **Web 서비스 (apps/web)** → **Variables** 탭 이동
2. 다음 두 변수를 **반드시** 추가/수정:
   - **NEXTAUTH_URL**  
     - FE의 **실제 배포 URL** (예: `https://jurin-i-web-production.up.railway.app`)  
     - **절대** `http://localhost:3000` 사용 금지  
     - Railway가 제공하는 도메인을 쓰려면: 서비스 **Settings** → **Networking**에서 **Generate domain** 후 나온 URL을 그대로 사용 (예: `https://xxxx.up.railway.app`)
   - **NEXTAUTH_SECRET**  
     - 32자 이상 랜덤 문자열  
     - 로컬 터미널에서 `openssl rand -base64 32` 실행 후 나온 값을 붙여넣기
3. 저장 후 **Redeploy** (Variables 변경 후 재배포 필요할 수 있음)
4. 재배포 후 FE URL 다시 접속하여 세션 오류가 사라졌는지 확인

---

## 1. FE (Web) Railway 환경 변수

**Railway 대시보드 → Web 서비스 (apps/web) → Variables** 에서 확인:

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `NEXTAUTH_URL` | ✅ | **실제 배포 URL** (예: `https://주리니-production.up.railway.app`). `localhost` 사용 금지! |
| `NEXTAUTH_SECRET` | ✅ | 32자 이상 랜덤 문자열. `openssl rand -base64 32` 로 생성 |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | BO 서비스 Railway URL (예: `https://stock-bo-production.up.railway.app`) |
| `NEXT_PUBLIC_X_API_KEY` | ✅ | BO API 인증 키 (Admin 서비스와 동일 값) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 소셜 로그인 시 | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | 소셜 로그인 시 | Google OAuth Secret |
| `NAVER_CLIENT_LOGIN_ID` | 네이버 로그인 시 | Naver OAuth 클라이언트 ID |
| `NAVER_CLIENT_LOGIN_SECRET` | 네이버 로그인 시 | Naver OAuth Secret |

**NEXTAUTH_URL 자동 설정**: Railway는 `RAILWAY_PUBLIC_DOMAIN`을 제공합니다.  
설정 예: `NEXTAUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}` (Railway Variable Reference 사용 시)

---

## 2. BO (Admin) Railway 환경 변수

**Railway 대시보드 → Admin 서비스 (apps/admin) → Variables** 에서 확인:

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 URL. Railway PostgreSQL 추가 시 자동 생성됨 |
| `ADMIN_EMAIL` | 초기 관리자 | 첫 배포 시 관리자 계정 이메일 |
| `ADMIN_PW` | 초기 관리자 | 관리자 비밀번호 |
| `SECRET_TOKEN` 또는 `X_API_KEY` | FE와 일치 | `NEXT_PUBLIC_X_API_KEY`와 같은 값 |

**주의**: `.env.local`의 `DB_HOST`와 `DATABASE_URL`의 호스트가 다르면 안 됩니다.  
Railway PostgreSQL 연결 시 **동일한 DB**의 `DATABASE_URL`을 사용하세요.

---

## 3. 502 "Application failed to respond" 원인

### BO(Admin) 502

1. **시작 시간 초과**: Admin 앱은 마이그레이션·스케줄러로 시작이 느립니다.  
   - Railway 로그에서 `애플리케이션 시작`, `데이터베이스 테이블 생성 완료` 메시지 확인  
   - DB 연결 실패 시 재시작을 반복할 수 있음

2. **DATABASE_URL 오류**:  
   - Railway PostgreSQL의 `DATABASE_URL`을 Admin 서비스 Variables에 정확히 붙여넣기  
   - `?sslmode=require` 등 SSL 옵션이 필요할 수 있음

3. **메모리 부족**: 마이그레이션·스케줄러가 많아 OOM 발생 가능. Railway 플랜 확인.

### FE(Web) 502

1. **콜드 스타트**: 첫 요청 시 빌드/시작이 늦으면 502 발생. 몇 초 후 재시도.

2. **NEXTAUTH_SECRET 미설정**: 세션 API가 실패하면 502처럼 보일 수 있음.

---

## 4. 확인 순서

1. **BO(Admin) 서비스**
   - Railway → Admin 서비스 → Deployments → 최신 배포 로그 확인
   - `🚀 애플리케이션 시작`, `✅ 데이터베이스 테이블 생성 완료` 출력 여부
   - BO URL 직접 접속: `https://stock-bo-production.up.railway.app/docs` (Swagger 문서)

2. **FE(Web) 서비스**
   - Railway → Web 서비스 → Variables에서 `NEXTAUTH_URL`, `NEXTAUTH_SECRET` 확인
   - `NEXTAUTH_URL`이 `https://실제도메인` 형태인지 확인 (localhost 아님)

3. **서비스 간 연결**
   - FE의 `NEXT_PUBLIC_API_BASE_URL`이 BO의 실제 Railway URL과 일치하는지 확인
   - FE와 BO가 같은 Railway 프로젝트 내에 있으면 Private Network로 연결 가능 (선택)

---

## 5. 빠른 체크

```bash
# NEXTAUTH_SECRET 생성
openssl rand -base64 32
```

- BO Swagger: `https://[BO-URL]/docs` → 200 응답 확인
- FE 메인: `https://[FE-URL]` → 정상 로드 확인
- 로그인 시도 → CLIENT_FETCH_ERROR 없으면 NEXTAUTH 설정 정상
