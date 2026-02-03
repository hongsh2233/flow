# @jurin-i/database

PostgreSQL 스키마 공유 패키지.

- **Prisma** (`prisma/`): Next.js(web)에서 사용. `DATABASE_URL` 환경 변수 필요.
- **SQLAlchemy**: Python(admin)에서는 `apps/admin/app/engine/` 의 모델 사용.

## 사용 (Web)

루트(jurin-i) `.env.local`에 `DATABASE_URL` 또는 `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` 설정.  
`db:generate`, `db:push`, `db:migrate` 스크립트는 루트 `.env.local`을 자동으로 로드합니다.

```bash
cd packages/database && npm install && npm run db:generate
```

- **DATABASE_URL**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` (Prisma·일부 도구용)
- Railway DB: Railway 대시보드에서 `DATABASE_URL` 또는 `DB_*` 값을 복사해 루트 `.env.local`에 넣으면 됨.
