# Railway 배포 (한 프로젝트에 모두 배포)

**네. Railway 한 프로젝트에 FE·BO·DB를 모두 올리면 됩니다.**

- **한 프로젝트** = Railway 대시보드에서 만드는 하나의 Project
- 그 안에 **서비스 3개** (또는 DB는 Railway PostgreSQL 추가): FE, BO, PostgreSQL

---

## 구성

| 서비스 | 앱 | Railway에서 |
|--------|-----|-------------|
| **FE** | `apps/web` (Next.js) | 서비스 1개, Root Directory: `apps/web` |
| **BO** | `apps/admin` (Python) | 서비스 1개, Root Directory: `apps/admin` |
| **DB** | PostgreSQL | Railway에서 **PostgreSQL 플러그인 추가** (docker-compose 말고 Railway DB 사용 권장) |

---

## 순서 요약

1. **Railway** → 새 프로젝트 생성
2. **PostgreSQL** → 같은 프로젝트에 "New" → "Database" → "PostgreSQL" 추가  
   → 연결 정보(`DATABASE_URL` 등) 자동 생성됨
3. **BO 서비스** → "New" → "GitHub Repo" → jurin-i 선택  
   - Root Directory: **`apps/admin`**  
   - Build: Nixpacks (Python 인식)  
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
   - 환경 변수: PostgreSQL에서 나온 `DATABASE_URL` 붙여넣기 + `ADMIN_EMAIL`, `SECRET_TOKEN` 등
4. **FE 서비스** → "New" → 같은 repo (jurin-i)  
   - Root Directory: **`apps/web`**  
   - Build: Nixpacks (Node 인식)  
   - 환경 변수:
     - `NEXT_PUBLIC_API_BASE_URL` = BO 서비스 URL (Railway가 준 주소)
     - `NEXTAUTH_URL` = FE 서비스 실제 URL (예: `https://xxx.up.railway.app`) — **localhost 사용 금지**
     - `NEXTAUTH_SECRET` = 32자 이상 랜덤 문자열 (`openssl rand -base64 32`)
     - `NEXT_PUBLIC_X_API_KEY` = BO와 동일한 API 키

---

## 502 / NextAuth 오류 발생 시

→ `RAILWAY_TROUBLESHOOTING.md` 참고

---

## 정리

- **배포는 Railway 한 곳(한 프로젝트)** 에 하면 됩니다.
- 그 한 프로젝트 안에 **FE 서비스 + BO 서비스 + PostgreSQL** 이렇게 넣으면 됩니다.
- 루트의 `railway.json`은 공통 빌드/재시작 설정이고, **Root Directory**는 각 서비스마다 `apps/web`, `apps/admin` 으로 따로 지정해야 합니다.
