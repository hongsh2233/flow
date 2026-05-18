# 로컬 실행 가이드

## 실행 순서

| 순서 | 대상 | 위치 | 명령 |
|------|------|------|------|
| 1 | DB | `apps/admin/` | `docker-compose up -d` |
| 2 | 백엔드 | `apps/admin/` | `uvicorn app.main:app --reload --port 8080` |
| 3 | 프론트 | `apps/web_new/` | `npm run dev` |

---

## 1. 환경 변수 설정

루트에 `.env.local` 생성 (루트 `README.md`의 환경 변수 섹션 참고):

```bash
cp .env.local.example .env.local  # 예시 파일이 있는 경우
# 또는 직접 생성
```

---

## 2. DB (PostgreSQL)

```bash
cd apps/admin
docker-compose up -d   # PostgreSQL 5432 포트로 실행
```

- DB명: `stock_bo` / 사용자: `postgres`
- 중지: `docker-compose stop`
- 초기화: `docker-compose down -v`

---

## 3. 백엔드 (FastAPI)

```bash
cd apps/admin

# 가상환경 생성 (최초 1회)
python -m venv venv

# 가상환경 활성화
source venv/bin/activate        # macOS/Linux
# .\venv\Scripts\activate       # Windows

# 패키지 설치 (최초 1회)
pip install -r requirements.txt

# 서버 실행
uvicorn app.main:app --reload --port 8080
```

- 백오피스 UI: http://localhost:8080
- API 문서 (Swagger): http://localhost:8080/docs

---

## 4. 프론트엔드 (Next.js)

```bash
cd apps/web_new

npm install   # 최초 1회
npm run dev   # http://localhost:3000
```

---

## 확인 사항

서버 시작 시 다음 메시지가 출력되면 정상:
- `데이터베이스 테이블 생성 완료`
- `초기 관리자 생성 완료`

오류 발생 시:
- `데이터베이스 연결 실패` → `.env.local`의 DB 설정 확인
- API 401 오류 → `X_API_KEY`가 Web·Admin 양쪽에서 동일한지 확인
