# Railway PostgreSQL 연결 설정 가이드

Railway에서 PostgreSQL 연결 정보를 받아서 설정하는 방법입니다.

## 📋 Railway에서 필요한 정보

Railway PostgreSQL 서비스에서 다음 정보를 확인하세요:

### 방법 1: DATABASE_URL 사용 (권장)

Railway 대시보드에서 PostgreSQL 서비스를 선택하면:
- **Variables** 탭에 `DATABASE_URL`이 자동으로 생성되어 있습니다
- 형식: `postgresql://user:password@host:port/database`

### 방법 2: 개별 변수 사용

Railway에서 다음 정보를 확인:
- `PGHOST` - 호스트 주소
- `PGPORT` - 포트 번호 (보통 5432)
- `PGUSER` - 사용자명
- `PGPASSWORD` - 비밀번호
- `PGDATABASE` - 데이터베이스 이름

---

## 🔧 설정 방법

### 로컬 개발용 (.env 파일)

`apps/admin/.env` 파일을 생성하고 다음 중 하나를 사용:

#### 옵션 1: DATABASE_URL 사용 (간단)

```env
# Railway PostgreSQL 연결
DATABASE_URL=postgresql://user:password@host:port/database

# 관리자 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your_password_here

# 인증 토큰
SECRET_TOKEN=your_secret_token_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# 공공데이터포털 API 키
DATA_GO_KR_API_KEY=your_api_key_here
```

#### 옵션 2: 개별 변수 사용

```env
# Railway PostgreSQL 연결 (개별 변수)
DB_HOST=your-railway-host.railway.app
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=railway

# 관리자 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your_password_here

# 인증 토큰
SECRET_TOKEN=your_secret_token_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# 공공데이터포털 API 키
DATA_GO_KR_API_KEY=your_api_key_here
```

### Railway 배포용 (환경 변수)

Railway 대시보드에서 BO 서비스의 **Variables** 탭에 설정:

1. **PostgreSQL 서비스 연결**:
   - **Add Reference** 클릭
   - PostgreSQL 서비스의 `DATABASE_URL` 선택
   - 자동으로 연결 정보가 주입됩니다

2. **추가 환경 변수**:
   ```
   ADMIN_EMAIL=admin@example.com
   ADMIN_PW=your_password_here
   SECRET_TOKEN=your_secret_token_here
   JWT_SECRET_KEY=your_jwt_secret_key_here
   DATA_GO_KR_API_KEY=your_api_key_here
   ```

---

## ✅ 연결 확인

설정 후 서버를 실행하면:

```bash
cd /Users/hongsungho/Jurin-i/apps/admin
source venv/bin/activate
./run.sh
```

로그에서 다음 메시지를 확인:
- ✅ `데이터베이스 테이블 생성 완료` - 연결 성공
- ⚠️ `데이터베이스 연결 실패: ...` - 연결 실패 (정보 확인 필요)

---

## 📝 테이블 자동 생성

서버가 시작되면 `app/main.py`의 다음 코드가 자동으로 실행됩니다:

```python
models.Base.metadata.create_all(bind=engine)
```

이 코드가 다음을 수행합니다:
1. PostgreSQL에 연결
2. `app/models.py`에 정의된 모든 테이블 자동 생성
3. 마이그레이션 실행 (초기 데이터 삽입 등)

**따라서 Railway PostgreSQL이 비어있어도 괜찮습니다!** 서버 시작 시 자동으로 테이블이 생성됩니다.

---

## 🔍 문제 해결

### 연결 실패 시 확인 사항

1. **Railway PostgreSQL이 실행 중인지 확인**
   - Railway 대시보드에서 PostgreSQL 서비스 상태 확인

2. **연결 정보 확인**
   - `DATABASE_URL` 형식이 올바른지 확인
   - 비밀번호에 특수문자가 있으면 URL 인코딩 필요

3. **방화벽/네트워크 확인**
   - Railway PostgreSQL은 외부 접속이 가능해야 함
   - Railway 대시보드에서 **Public Network** 설정 확인

4. **포트 확인**
   - Railway PostgreSQL 포트가 5432인지 확인
   - 일부 경우 다른 포트를 사용할 수 있음

---

## 💡 팁

- **로컬 개발**: `.env` 파일 사용
- **Railway 배포**: 환경 변수 사용 (`.env` 파일은 Git에 커밋하지 않음)
- **DATABASE_URL 우선**: 코드는 `DATABASE_URL`을 먼저 확인하고, 없으면 개별 변수를 사용합니다

---

## 📞 연결 정보 제공 시

Railway에서 다음 정보를 알려주시면 바로 설정해드리겠습니다:

1. `DATABASE_URL` 전체 문자열, 또는
2. 개별 변수들:
   - Host
   - Port
   - User
   - Password
   - Database name

