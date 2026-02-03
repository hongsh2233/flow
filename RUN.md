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

### 2) 환경 변수

**방법 A – 루트 `.env.local` 한 곳에서 사용 (권장)**  
`jurin-i/.env.local` 파일 하나에 web·admin 공용 변수를 넣으면 두 앱 모두에서 사용합니다.

- **web**: Next.js가 루트 `.env.local`을 자동 로드
- **admin**: Python이 루트 `.env.local`을 먼저 읽고, 없으면 `apps/admin/.env` 사용

루트 `.env.local` 예시 (BO용 추가 변수):

```env
# DB (1번에서 docker-compose로 띄운 경우)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_bo
DB_USER=postgres
DB_PASSWORD=postgres_password

# Admin 인증
ADMIN_EMAIL=admin@example.com
ADMIN_PW=원하는비밀번호
SECRET_TOKEN=아무랜덤문자열
JWT_SECRET_KEY=아무랜덤문자열
DATA_GO_KR_API_KEY=공공데이터API키

# Web과 공유 (FE ↔ BO API 키)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_X_API_KEY=1978022019820308200705092018111420220303
```

**방법 B – admin만 별도 .env**  
`apps/admin/.env`만 쓰려면 `copy .env.example .env` 후 위와 같이 설정합니다.

### 3) 서버 실행 (Windows)

**CMD:**

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\admin
.\run.bat
```

**PowerShell:**

```powershell
cd C:\Users\T51\Desktop\jurin-i\apps\admin
.\run.ps1
```

직접 실행할 때:

```powershell
.\venv\Scripts\activate
$env:PYTHONPATH = "."   # PowerShell
uvicorn app.main:app --reload --port 8080
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

### 2) 환경 변수

**루트 `.env.local` 사용 시** (권장): `jurin-i/.env.local`에 아래가 있으면 web·admin 공용으로 사용됩니다.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_X_API_KEY=1978022019820308200705092018111420220303
```

(API 키는 BO와 동일하게 맞추면 됩니다. 루트에 두면 두 앱 모두에서 사용 가능합니다.)

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
