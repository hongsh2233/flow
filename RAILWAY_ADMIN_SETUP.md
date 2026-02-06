# Railway 관리자 계정 설정 가이드

## 🔍 문제: DB에 관리자 정보가 없어서 로그인이 안됨

Railway 배포 후 관리자 계정이 자동으로 생성되지 않는 경우가 있습니다.

### 원인

1. **환경 변수 미설정**: Railway Variables에 `ADMIN_EMAIL`과 `ADMIN_PW`가 설정되지 않음
2. **DB 연결 실패**: 서버 시작 시 DB 연결이 실패하여 관리자 생성 실패
3. **초기화 타이밍**: DB 테이블이 생성되기 전에 관리자 생성 시도

---

## ✅ 해결 방법

### 방법 1: Railway Variables 설정 후 재배포 (권장)

1. **Railway 대시보드 → Admin 서비스 → Variables** 탭 이동

2. 다음 환경 변수 추가/수정:
   ```
   ADMIN_EMAIL=admin@example.com
   ADMIN_PW=your-secure-password
   ```
   - `ADMIN_EMAIL`: 관리자 이메일 (로그인 시 사용)
   - `ADMIN_PW`: 관리자 비밀번호 (최소 8자 권장)

3. **Admin 서비스 Redeploy** (Variables 변경 후 재배포 필요)

4. **배포 로그 확인**:
   - Railway → Admin 서비스 → Deployments → 최신 배포 로그
   - 다음 메시지 확인:
     ```
     ✅ 데이터베이스 테이블 생성 완료
     ⚠️ 초기 관리자 계정 생성 중
     ✅ 초기 관리자 생성 완료
     ```

5. **로그인 테스트**:
   - Admin 로그인 페이지 접속: `https://your-admin-service.up.railway.app/login`
   - 설정한 이메일과 비밀번호로 로그인

---

### 방법 2: 관리자 계정 수동 생성 (스크립트 사용)

환경 변수를 설정했지만 관리자가 생성되지 않은 경우:

#### 2-1. Railway CLI 사용 (권장)

1. **Railway CLI 설치** (아직 설치하지 않은 경우):
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **프로젝트 연결**:
   ```bash
   cd apps/admin
   railway link
   ```

3. **관리자 계정 생성 스크립트 실행**:
   ```bash
   railway run python create-admin.py admin@example.com yourpassword123
   ```

#### 2-2. Railway Shell 사용

1. **Railway 대시보드 → Admin 서비스 → Deployments → 최신 배포 → Shell** 클릭

2. **스크립트 실행**:
   ```bash
   cd /workspace
   python create-admin.py admin@example.com yourpassword123
   ```

#### 2-3. 로컬에서 Railway DB 연결

1. **Railway PostgreSQL 연결 정보 확인**:
   - Railway → PostgreSQL 서비스 → Variables
   - `DATABASE_URL` 복사

2. **로컬에서 환경 변수 설정**:
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
   export ADMIN_EMAIL="admin@example.com"
   export ADMIN_PW="yourpassword123"
   ```

3. **스크립트 실행**:
   ```bash
   cd apps/admin
   python create-admin.py
   ```

---

### 방법 3: SQL 직접 실행 (고급)

Railway PostgreSQL에 직접 접속하여 관리자 계정 생성:

1. **Railway → PostgreSQL → Connect** 클릭
2. **psql 또는 데이터베이스 클라이언트로 연결**
3. **SQL 실행**:
   ```sql
   -- 비밀번호 해시 생성 (Python에서 생성 필요)
   -- Python에서: from app import utils; print(utils.get_password_hash("yourpassword"))
   
   INSERT INTO admin_users (email, name, hashed_password, created_at)
   VALUES (
       'admin@example.com',
       '최고관리자',
       '$2b$12$...',  -- Python으로 생성한 해시
       NOW()
   );
   ```

**주의**: 비밀번호 해시는 Python의 `bcrypt`로 생성해야 합니다.

---

## 🔧 스크립트 사용법

### create-admin.py 스크립트

**위치**: `apps/admin/create-admin.py`

**사용법 1: 명령줄 인자 사용**
```bash
python create-admin.py admin@example.com yourpassword123
```

**사용법 2: 환경 변수 사용**
```bash
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PW="yourpassword123"
python create-admin.py
```

**기능:**
- 이미 존재하는 이메일인지 확인
- 비밀번호 해시 자동 생성
- 관리자 계정 생성
- 성공/실패 메시지 출력

---

## 📋 체크리스트

관리자 계정 생성 확인:

- [ ] Railway Variables에 `ADMIN_EMAIL` 설정
- [ ] Railway Variables에 `ADMIN_PW` 설정 (최소 8자)
- [ ] Admin 서비스 재배포 완료
- [ ] 배포 로그에서 "✅ 초기 관리자 생성 완료" 메시지 확인
- [ ] Admin 로그인 페이지 접속 가능
- [ ] 설정한 이메일/비밀번호로 로그인 성공

---

## 🚨 문제 해결

### 문제 1: "❌ 초기 관리자 생성 실패" 오류

**원인**: DB 연결 실패 또는 환경 변수 미설정

**해결**:
1. Railway → Admin 서비스 → Variables에서 `DATABASE_URL` 확인
2. Railway → Admin 서비스 → Variables에서 `ADMIN_EMAIL`, `ADMIN_PW` 확인
3. 배포 로그에서 DB 연결 오류 메시지 확인

### 문제 2: "이미 존재하는 이메일입니다" 오류

**원인**: 해당 이메일의 관리자가 이미 존재

**해결**:
- 다른 이메일 사용
- 또는 기존 관리자로 로그인 시도

### 문제 3: 로그인은 되지만 "Not authenticated" 오류

**원인**: `SECRET_TOKEN` 환경 변수 미설정

**해결**:
1. Railway → Admin 서비스 → Variables에 `SECRET_TOKEN` 추가
2. `openssl rand -base64 32`로 생성한 값 사용
3. Admin 서비스 재배포

---

## 💡 참고

- 관리자 계정은 서버 시작 시 자동으로 생성됩니다 (`init_admin_user()` 함수)
- 환경 변수가 설정되어 있고, 해당 이메일의 관리자가 없을 때만 생성됩니다
- Railway 배포 시 환경 변수는 **Railway Variables**에서 설정해야 합니다
- 로컬의 `.env.local` 파일은 Railway에서 사용되지 않습니다

---

## 📝 관련 문서

- 환경 변수 설정: `ENV_SETUP.md`
- Railway 배포: `RAILWAY_DEPLOY.md`
- 인증 오류 해결: `RAILWAY_AUTH_FIX.md`

