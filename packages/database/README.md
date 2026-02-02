# @jurin-i/database

PostgreSQL 스키마 공유 패키지.

- **Prisma** (`prisma/`): Next.js(web)에서 사용. `DATABASE_URL` 환경 변수 필요.
- **SQLAlchemy**: Python(admin)에서는 `apps/admin/app/engine/` 의 모델 사용.

## 사용 (Web)

```bash
cd packages/database && npm install && npx prisma generate
```

apps/web의 `.env`에 `DATABASE_URL=postgresql://user:pass@host:5432/stock_bo` 설정.
