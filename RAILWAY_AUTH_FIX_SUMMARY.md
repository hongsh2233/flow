# Railway 인증 오류 해결 요약

## 🔧 수정 완료 사항

### 1. 코드 수정: `apps/admin/app/routers/api.py`

**문제:**
- `api.py`에서 하드코딩된 `API_ACCESS_KEY`를 사용
- 다른 라우터들은 환경 변수(`NEXT_PUBLIC_X_API_KEY`)를 사용
- Railway에서 환경 변수를 변경해도 `api.py`의 라우터들은 여전히 하드코딩된 값을 기대

**수정:**
- `api.py`의 로컬 `verify_api_key` 함수 제거
- `dependencies.py`의 `verify_api_key`를 import하여 사용
- 모든 라우터가 환경 변수를 일관되게 사용하도록 통일

**변경 파일:**
- `apps/admin/app/routers/api.py`

---

## ✅ Railway 배포 시 확인 사항

### 필수 환경 변수 설정

#### Admin 서비스 (`apps/admin`)
- `NEXT_PUBLIC_X_API_KEY` = Web과 동일한 값
- `DATABASE_URL` = PostgreSQL 연결 URL
- `ADMIN_EMAIL` = 초기 관리자 이메일
- `ADMIN_PW` = 초기 관리자 비밀번호
- `SECRET_TOKEN` = 세션 인증 토큰

#### Web 서비스 (`apps/web`)
- `NEXT_PUBLIC_X_API_KEY` = **Admin과 정확히 동일한 값**
- `NEXT_PUBLIC_API_BASE_URL` = Admin 서비스 Railway URL
- `NEXTAUTH_URL` = Web 서비스 실제 배포 URL (localhost 금지)
- `NEXTAUTH_SECRET` = 32자 이상 랜덤 문자열

---

## 🚀 배포 후 확인

1. **Admin Swagger 문서 접속**
   ```
   https://your-admin-service.up.railway.app/docs
   ```
   - 200 응답 확인

2. **Web 메인 페이지 접속**
   ```
   https://your-web-service.up.railway.app
   ```
   - 페이지 정상 로드 확인

3. **브라우저 개발자 도구 → Network 탭**
   - Admin API 호출 시 200 응답 확인
   - 401 오류가 없어야 함

---

## 📝 참고 문서

- 상세 가이드: `RAILWAY_AUTH_FIX.md`
- 배포 가이드: `RAILWAY_DEPLOY.md`
- 트러블슈팅: `RAILWAY_TROUBLESHOOTING.md`

