# PostgreSQL 설정 가이드

## 방법 선택

### 방법 1: Docker 사용 (Docker 설치된 경우)

```bash
cd /Users/hongsungho/Jurin-i/apps/admin
docker compose up -d db
# 또는 (구버전)
docker-compose up -d db
```

### 방법 2: 로컬 설치 (Docker 없이)

자세한 내용은 `SETUP_POSTGRESQL.md` 파일을 참고하세요.

간단 요약:
```bash
# Homebrew로 설치
brew install postgresql@16
brew services start postgresql@16
createdb stock_bo
```

## 2. .env 파일 생성

`apps/admin/.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# 관리자 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PW=your_password_here

# 인증 토큰
SECRET_TOKEN=your_secret_token_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# PostgreSQL 데이터베이스 설정 (docker-compose.yml과 일치)
DB_USER=postgres
DB_PASSWORD=postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo

# 공공데이터포털 API 키 (선택사항)
DATA_GO_KR_API_KEY=your_api_key_here
```

## 3. 서버 실행

```bash
cd /Users/hongsungho/Jurin-i/apps/admin
source venv/bin/activate
./run.sh
```

또는:

```bash
cd /Users/hongsungho/Jurin-i/apps/admin
source venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

## 4. PostgreSQL 컨테이너 확인

컨테이너가 실행 중인지 확인:

```bash
docker ps | grep stock-postgres
```

컨테이너 로그 확인:

```bash
docker logs stock-postgres
```

## 5. PostgreSQL 컨테이너 중지

```bash
docker-compose down
```

데이터를 유지하면서 중지하려면:

```bash
docker-compose stop db
```

## 6. 문제 해결

### PostgreSQL 연결 오류가 발생하는 경우

1. **컨테이너가 실행 중인지 확인:**
   ```bash
   docker ps -a | grep stock-postgres
   ```

2. **컨테이너 재시작:**
   ```bash
   docker-compose restart db
   ```

3. **포트 충돌 확인:**
   ```bash
   lsof -i :5432
   ```
   다른 프로세스가 5432 포트를 사용 중이면 중지하거나 docker-compose.yml의 포트를 변경하세요.

4. **데이터베이스 초기화 (주의: 모든 데이터 삭제):**
   ```bash
   docker-compose down -v
   docker-compose up -d db
   ```

## 7. 데이터베이스 직접 접속

```bash
docker exec -it stock-postgres psql -U postgres -d stock_bo
```

## 참고

- PostgreSQL 컨테이너는 `docker-compose.yml`에 정의되어 있습니다.
- 데이터는 Docker 볼륨(`postgres_data`)에 저장되어 컨테이너를 재시작해도 유지됩니다.
- `.env` 파일은 Git에 커밋하지 마세요 (보안상 중요).

