# Jurin-i Monorepo 검토 (폴더 이동 후)

**검토일**: 폴더를 `stock` 내부에서 **Desktop/jurin-i** (외부)로 수동 이동한 뒤 검토.

---

## 1. 현재 위치 및 구조

| 항목 | 상태 |
|------|------|
| **monorepo 경로** | `C:\Users\T51\Desktop\jurin-i` (stock과 동급, study 외부) |
| **apps/web** | Next.js 앱 존재, package.json·app·components 등 정상 |
| **apps/admin** | FastAPI 앱, app/engine, app/dashboard, dashboard/templates·static 존재 |
| **packages/database** | prisma/schema.prisma, package.json 존재 |
| **packages/ui** | placeholder (package.json, README) |
| **railway.json** | 루트에 존재 |

**결론**: 폴더 이동 후에도 **monorepo 루트 구조는 올바릅니다.**

---

## 2. 경로/설정 검증 (이동 후에도 유효한지)

### Admin – `.env` 로드

- **app/engine/database.py**  
  `_base = Path(__file__).resolve().parent.parent.parent`  
  → `__file__` = `.../jurin-i/apps/admin/app/engine/database.py`  
  → `parent.parent.parent` = `.../jurin-i/apps/admin`  
  → `.env` 경로 = `apps/admin/.env`  
  **이동 후에도 올바릅니다.**

- **app/config.py**  
  `BASE_DIR = Path(__file__).resolve().parent.parent`  
  → `apps/admin/app/config.py` 기준으로 `apps/admin`  
  **이동 후에도 올바릅니다.**

### Admin – 템플릿/정적 파일

- 라우터: `Jinja2Templates(directory="dashboard/templates")`
- main.py: `StaticFiles(directory="dashboard/static")`
- 실행 시 CWD = `apps/admin` 이면 `dashboard/templates`, `dashboard/static` 상대 경로로 정상 동작  
  **이동 후에도 올바릅니다.**

### Web

- API 등은 `NEXT_PUBLIC_API_BASE_URL` 등 **환경 변수** 사용.  
  **절대 경로/stock 경로 하드코딩 없음** → 이동해도 문제 없음.

---

## 3. 수정 필요 사항

### 1) `apps/web/Jurin-i` 중첩 폴더 제거 (필수)

이전에 `stock` 안에 있던 구조를 복사할 때 생긴 **중복 폴더**입니다.

- **경로**: `jurin-i/apps/web/Jurin-i/`  
  (그 안에 `jurin-i-monorepo/apps/web/...` 식으로 또 복사본이 있음)
- **조치**: 아래 폴더를 **수동으로 삭제**해 주세요.  
  `C:\Users\T51\Desktop\jurin-i\apps\web\Jurin-i`
- 삭제 후 `apps/web` 아래에는 `app`, `package.json`, `public` 등만 있고, `Jurin-i` 폴더는 없어야 합니다.

### 2) `apps/admin/engine` (선택)

- **현재**: `apps/admin/engine/` 에는 `.gitkeep` 만 있음.
- **실제 엔진 코드**: `apps/admin/app/engine/` (database, models, services, migrations)
- **조치**: 정리하고 싶다면 `apps/admin/engine/` 폴더는 삭제해도 됩니다. (선택)

---

## 4. 실행 확인 방법

이동 후에도 다음만 지키면 됩니다.

1. **Admin**  
   - `cd C:\Users\T51\Desktop\jurin-i\apps\admin`  
   - `.env` 에 PostgreSQL 정보 (또는 `DATABASE_URL`) 설정  
   - `uvicorn app.main:app --reload`
2. **Web**  
   - `cd C:\Users\T51\Desktop\jurin-i\apps\web`  
   - `npm install && npm run dev`
3. **DB**  
   - `apps/admin` 에서 `docker-compose up -d` (PostgreSQL)

---

## 5. 요약

| 항목 | 결과 |
|------|------|
| monorepo 위치 (Desktop/jurin-i) | 정상 |
| admin 경로 의존성 (.env, config, dashboard) | 이동 후에도 정상 |
| web 경로/환경 변수 | 이동 후에도 정상 |
| packages/database, ui, railway.json | 구조 정상 |
| **필수 조치** | `apps/web/Jurin-i` 폴더 수동 삭제 |
| **선택 조치** | `apps/admin/engine` (빈 폴더) 삭제 |

위만 반영하면 **폴더 이동 후에도 구성은 제대로 된 상태**입니다.
