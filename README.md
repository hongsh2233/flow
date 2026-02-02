# Jurin-i Monorepo

통합 레포지토리: Next.js 웹(사용자용) + Python 백오피스(관리자용). **DB: PostgreSQL** (MySQL에서 전환).

- **apps/web** - Next.js 메인 서비스
- **apps/admin** - Python 백오피스 (engine: DB·스크래퍼/AI, dashboard: UI)
- **packages/database** - PostgreSQL 스키마 (Prisma/SQLAlchemy)
- **packages/ui** - 공통 UI 컴포넌트
- **railway.json** - Railway 통합 배포 설정

## Git 초기화 및 푸시

```powershell
cd C:\Users\T51\Desktop\jurin-i
git init
git add -A
git commit -m "Initial commit: jurin-i monorepo"
git branch -M main
git remote add origin <원격저장소URL>
git push -u origin main
```

또는 `scripts/git-init.ps1` 실행 후 위 커밋/원격/푸시만 진행.

## 로컬 실행

- **Web**: `cd apps/web && npm install && npm run dev`
- **Admin**: `cd apps/admin` 후 `pip install -r requirements.txt`, `.env` 설정(PostgreSQL: DB_HOST, DB_PORT=5432, DB_NAME=stock_bo), `uvicorn app.main:app --reload`
- **DB**: `cd apps/admin && docker-compose up -d` (PostgreSQL 16, 포트 5432)
