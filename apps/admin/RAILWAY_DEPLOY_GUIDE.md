# Railway 배포 가이드 (PostgreSQL 포함)

Railway에 배포할 때는 **Railway에서 PostgreSQL을 생성하고 연결**하는 것이 가장 간단하고 안정적입니다.

## 🎯 배포 전략

### ✅ 권장: Railway PostgreSQL 사용
- Railway 대시보드에서 PostgreSQL 플러그인 추가
- `DATABASE_URL` 환경 변수 자동 생성
- 백업, 스케일링 등 관리 기능 제공
- 무료 플랜에서도 사용 가능

### ❌ 비권장: 로컬 DB 연결
- 로컬 PostgreSQL을 Railway에서 연결하려면 공개 IP와 방화벽 설정 필요
- 보안 위험 및 복잡도 증가

---

## 📋 배포 순서

### 1단계: Railway 프로젝트 생성

1. [Railway](https://railway.app)에 로그인
2. **New Project** 클릭
3. **Deploy from GitHub repo** 선택
4. `jurin-i` 저장소 선택

### 2단계: PostgreSQL 데이터베이스 추가

1. Railway 프로젝트 대시보드에서 **New** 버튼 클릭
2. **Database** → **PostgreSQL** 선택
3. PostgreSQL 서비스가 생성되면 자동으로 다음 환경 변수가 생성됩니다:
   - `DATABASE_URL` (전체 연결 문자열)
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (개별 변수)

### 3단계: BO (백오피스) 서비스 배포

1. Railway 프로젝트에서 **New** → **GitHub Repo** 선택
2. 같은 `jurin-i` 저장소 선택
3. 서비스 설정:
   - **Root Directory**: `apps/admin`
   - **Build Command**: (자동 감지 또는 비워둠)
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Variables** 탭에서 환경 변수 추가:

```env
# PostgreSQL 연결 (PostgreSQL 서비스에서 자동 생성된 변수 연결)
# Railway가 자동으로 DATABASE_URL을 제공하므로 별도 설정 불필요

# 관리자 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your_secure_password_here

# 인증 토큰
SECRET_TOKEN=your_random_secret_token_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# 공공데이터포털 API 키
DATA_GO_KR_API_KEY=your_api_key_here
```

5. **PostgreSQL 서비스 연결**:
   - BO 서비스의 **Variables** 탭에서
   - **Add Reference** 클릭
   - PostgreSQL 서비스의 `DATABASE_URL` 선택
   - 이렇게 하면 Railway가 자동으로 연결 정보를 주입합니다

### 4단계: FE (프론트엔드) 서비스 배포

1. Railway 프로젝트에서 **New** → **GitHub Repo** 선택
2. 같은 `jurin-i` 저장소 선택
3. 서비스 설정:
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Variables** 탭에서 환경 변수 추가:

```env
# BO 서비스 URL (Railway가 생성한 도메인)
NEXT_PUBLIC_API_BASE_URL=https://your-bo-service.railway.app

# NextAuth 설정
NEXTAUTH_URL=https://your-fe-service.railway.app
NEXTAUTH_SECRET=your_nextauth_secret_here

# 소셜 로그인 (선택사항)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NAVER_CLIENT_LOGIN_ID=your_naver_client_id
NAVER_CLIENT_LOGIN_SECRET=your_naver_client_secret
NEXT_PUBLIC_X_API_KEY=your_api_key_here
```

---

## 🔧 코드 확인 사항

현재 코드는 이미 Railway의 `DATABASE_URL`을 지원합니다:

```python
# apps/admin/app/engine/database.py
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",  # Railway가 자동 제공
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
```

Railway가 `DATABASE_URL`을 제공하면 자동으로 사용됩니다.

---

## 📝 환경 변수 정리

### PostgreSQL 서비스 (자동 생성)
- `DATABASE_URL` - 전체 연결 문자열
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### BO 서비스 (필수)
- `DATABASE_URL` - PostgreSQL 서비스에서 참조
- `ADMIN_EMAIL` - 관리자 이메일
- `ADMIN_PW` - 관리자 비밀번호
- `SECRET_TOKEN` - 세션 인증 토큰
- `JWT_SECRET_KEY` - JWT 토큰 암호화 키
- `DATA_GO_KR_API_KEY` - 공공데이터포털 API 키 (선택)

### FE 서비스 (필수)
- `NEXT_PUBLIC_API_BASE_URL` - BO 서비스 URL
- `NEXTAUTH_URL` - FE 서비스 URL
- `NEXTAUTH_SECRET` - NextAuth 비밀키
- `NEXT_PUBLIC_X_API_KEY` - API 인증 키

---

## 🚀 배포 후 확인

1. **PostgreSQL 연결 확인**:
   - BO 서비스 로그에서 "✅ 데이터베이스 테이블 생성 완료" 메시지 확인

2. **서비스 URL 확인**:
   - 각 서비스의 **Settings** → **Domains**에서 URL 확인
   - FE 서비스의 `NEXT_PUBLIC_API_BASE_URL`이 BO 서비스 URL과 일치하는지 확인

3. **데이터베이스 접속**:
   - Railway PostgreSQL 서비스에서 **Connect** 버튼 클릭
   - 연결 정보 확인 가능

---

## 💡 팁

### 로컬 개발 vs Railway 배포

**로컬 개발 시**:
- `.env` 파일에 `DB_HOST=localhost`, `DB_PORT=5432` 등 설정
- 로컬 PostgreSQL 또는 Docker Compose 사용

**Railway 배포 시**:
- `DATABASE_URL` 환경 변수만 설정 (Railway가 자동 제공)
- 별도의 DB 호스트/포트 설정 불필요

### 데이터베이스 마이그레이션

Railway에 배포하면 `app/main.py`의 `run_migrations()` 함수가 자동으로 실행되어:
- 테이블 생성
- 초기 데이터 삽입
- 마이그레이션 실행

모두 자동으로 처리됩니다.

---

## 🔒 보안 주의사항

1. **환경 변수는 절대 Git에 커밋하지 마세요**
2. **프로덕션 비밀번호는 강력하게 설정하세요**
3. **Railway의 환경 변수는 암호화되어 저장됩니다**
4. **`DATABASE_URL`은 Railway가 자동으로 관리하므로 수동 설정 불필요**

---

## 📚 참고 문서

- [Railway 공식 문서](https://docs.railway.app)
- [Railway PostgreSQL 가이드](https://docs.railway.app/databases/postgresql)
- 프로젝트 내 `RAILWAY_DEPLOY.md` 파일

