# Jurin-i 실행 방법

**BO(백오피스), FE(프론트), DB가 모두 같은 폴더(jurin-i) 안에 있습니다.**

```
jurin-i/
├── apps/
│   ├── web/          ← FE (Next.js, 사용자용)
│   └── admin/        ← BO (Python FastAPI, 관리자용)
├── packages/
│   └── database/     ← DB 스키마 (Prisma, PostgreSQL)
└── ...
```

- **FE**: `apps/web` (Next.js)
- **BO**: `apps/admin` (FastAPI + Jinja2)
- **DB**: PostgreSQL — `apps/admin/docker-compose.yml`로 실행 (또는 외부 PostgreSQL 사용)

---

## 1. DB (PostgreSQL) 실행

BO가 DB에 연결하므로 **먼저 DB를 띄운 뒤** BO를 실행합니다.

**위치**: `jurin-i/apps/admin/`

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\admin
docker-compose up -d
```

- PostgreSQL 16, 포트 **5432**
- DB명: `stock_bo`, 사용자: `postgres`, 비밀번호: `postgres_password`
- 로컬에서만 쓸 때: `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=stock_bo` 로 설정

DB만 중지: `docker-compose stop`  
DB+볼륨까지 제거: `docker-compose down -v`

---

## 2. BO (백오피스) 실행

**위치**: `jurin-i/apps/admin/`

### 1) 가상환경 + 패키지 설치

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\admin
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2) 환경 변수 (.env)

`apps/admin/.env` 파일을 만들고 아래처럼 설정 (DB는 1번에서 띄운 경우):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo
DB_USER=postgres
DB_PASSWORD=postgres_password

ADMIN_EMAIL=admin@example.com
ADMIN_PW=원하는비밀번호
SECRET_TOKEN=아무랜덤문자열
JWT_SECRET_KEY=아무랜덤문자열
DATA_GO_KR_API_KEY=공공데이터API키
```

`.env.example`을 복사해서 쓰면 됩니다: `copy .env.example .env`

### 3) 서버 실행

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\admin
.\venv\Scripts\activate
set PYTHONPATH=.
uvicorn app.main:app --reload --port 8080
```

또는 `run.bat` 사용 (가상환경 활성화 후):

```powershell
.\run.bat
```

- 백오피스 UI: **http://localhost:8080**
- API: **http://localhost:8080/docs** (Swagger)

---

## 3. FE (프론트, Next.js) 실행

**위치**: `jurin-i/apps/web/`

### 1) 패키지 설치

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\web
npm install
```

### 2) 환경 변수 (.env.local)

BO API 주소를 알려주기 위해 `apps/web/.env.local` 생성:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_X_API_KEY=1978022019820308200705092018111420220303
```

(API 키는 BO 쪽과 맞추면 됩니다.)

### 3) 개발 서버 실행

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\web
npm run dev
```

- 프론트: **http://localhost:3000**

---

## 실행 순서 요약

| 순서 | 대상 | 명령 | 접속 주소 |
|------|------|------|-----------|
| 1 | DB | `cd apps/admin` → `docker-compose up -d` | (내부 5432) |
| 2 | BO | `cd apps/admin` → venv 활성화 → `uvicorn app.main:app --reload --port 8080` | http://localhost:8080 |
| 3 | FE | `cd apps/web` → `npm install` → `npm run dev` | http://localhost:3000 |

- FE가 BO API(`NEXT_PUBLIC_API_BASE_URL`)를 호출하고, BO가 DB(PostgreSQL)에 연결하는 구조입니다.
- **packages/database**는 Prisma 스키마만 있고, 실제 DB 프로세스는 `apps/admin/docker-compose`의 PostgreSQL입니다.
