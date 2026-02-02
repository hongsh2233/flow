# PostgreSQL 로컬 설치 가이드 (macOS)

Docker 없이 로컬에 PostgreSQL을 설치하는 방법입니다.

## 방법 1: Homebrew로 설치 (권장)

### 1단계: Homebrew 설치 확인

```bash
brew --version
```

Homebrew가 없으면 다음 명령어로 설치:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2단계: PostgreSQL 설치

```bash
brew install postgresql@16
```

### 3단계: PostgreSQL 서비스 시작

```bash
brew services start postgresql@16
```

### 4단계: 데이터베이스 생성

```bash
# PostgreSQL에 접속
psql postgres

# 데이터베이스 생성
CREATE DATABASE stock_bo;

# 사용자 비밀번호 설정 (선택사항)
ALTER USER postgres WITH PASSWORD 'postgres_password';

# 종료
\q
```

또는 명령어로 직접 생성:

```bash
createdb stock_bo
```

### 5단계: 연결 확인

```bash
psql -d stock_bo
```

## 방법 2: PostgreSQL.app 사용 (GUI)

1. https://postgresapp.com/ 에서 다운로드
2. 앱 설치 후 실행
3. "Initialize" 버튼 클릭하여 서버 시작
4. 터미널에서 다음 명령어 실행:

```bash
sudo mkdir -p /etc/paths.d &&
echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
```

5. 새 터미널 열고 데이터베이스 생성:

```bash
createdb stock_bo
```

## .env 파일 설정

`apps/admin/.env` 파일을 생성하고 다음 내용을 추가:

```env
# 관리자 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your_password_here

# 인증 토큰
SECRET_TOKEN=your_secret_token_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# PostgreSQL 데이터베이스 설정
DB_USER=postgres  # 또는 현재 사용자명
DB_PASSWORD=      # 로컬 설치 시 비밀번호가 없을 수 있음
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo

# 공공데이터포털 API 키 (선택사항)
DATA_GO_KR_API_KEY=your_api_key_here
```

## PostgreSQL 서비스 관리

### 서비스 시작
```bash
brew services start postgresql@16
```

### 서비스 중지
```bash
brew services stop postgresql@16
```

### 서비스 재시작
```bash
brew services restart postgresql@16
```

### 서비스 상태 확인
```bash
brew services list | grep postgresql
```

## 문제 해결

### 포트 5432가 이미 사용 중인 경우

```bash
# 포트를 사용하는 프로세스 확인
lsof -i :5432

# 프로세스 종료 (PID 확인 후)
kill -9 <PID>
```

### PostgreSQL이 시작되지 않는 경우

```bash
# 로그 확인
tail -f /usr/local/var/log/postgresql@16.log

# 또는
tail -f /opt/homebrew/var/log/postgresql@16.log
```

### 데이터베이스에 접속할 수 없는 경우

```bash
# PostgreSQL이 실행 중인지 확인
pg_isready

# 사용자 확인
psql -l
```

## 참고

- PostgreSQL 기본 사용자: 현재 macOS 사용자명 또는 `postgres`
- 기본 포트: 5432
- 데이터 저장 위치: `/usr/local/var/postgresql@16` 또는 `/opt/homebrew/var/postgresql@16`

