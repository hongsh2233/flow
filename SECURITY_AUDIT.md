# 금융 서비스 보안 점검 보고서

## 🔴 Critical (즉시 조치 필요)

### 1. 비밀번호 재설정 인증코드 미발송
**위치:** `apps/admin/app/routers/auth.py` - `api_request_password_reset`

- **문제:** 인증코드가 생성·저장만 되고 **실제 이메일 발송이 구현되어 있지 않음**
- **영향:** 사용자가 비밀번호 찾기를 해도 코드를 받지 못함. "인증코드가 이메일로 발송되었습니다" 메시지는 거짓
- **조치:** SMTP/이메일 발송 로직 추가 또는 외부 이메일 서비스(SendGrid, AWS SES 등) 연동

### 2. API 키·시크릿 기본값 하드코딩
**위치:**
- `apps/admin/app/dependencies.py`: `API_SECRET_KEY` 기본값 `"1978022019820308200705092018111420220303"`
- `apps/admin/app/config.py`: `SECRET_TOKEN` 기본값 `"dev-secret-token-change-in-production-12345"`
- `apps/admin/app/services/api_service.py`: `KRX_API_KEY` 기본값 `"73346D637E1B47AA8B653668D4D969288CEAB195"`

- **문제:** 프로덕션에서 환경 변수 미설정 시 기본값 사용 → 예측 가능한 키로 인증 우회 가능
- **조치:** 프로덕션 배포 시 환경 변수 필수화, 기본값 사용 시 앱 시작 차단

### 3. XSS 위험 - dangerouslySetInnerHTML
**위치:**
- `apps/web_new/app/components/module/PopupModal.tsx` - `html_content`
- `apps/web_new/app/components/module/board/BoardDetail.tsx` - `post.content`
- `apps/web_new/app/components/module/AdBanner.tsx` - `item.htmlContent`
- `apps/web_new/app/components/module/SingleBanner.tsx` - `item.html_content`
- `apps/web_new/app/about/page.tsx` - 약관/소개 HTML

- **문제:** 관리자·DB에서 오는 HTML을 그대로 렌더링. 악성 스크립트 삽입 시 XSS 발생
- **조치:** DOMPurify 등으로 HTML 새니타이즈 후 렌더링

---

## 🟠 High (우선 조치 권장)

### 4. 비밀번호 재설정 API Rate Limit 부족
**위치:** `api_reset_password` (POST /api/auth/member/reset-password)

- **문제:** `api_request_password_reset`은 5/minute 제한 있으나, `api_reset_password`에는 제한 없음
- **영향:** 6자리 코드 브루트포스 시도 가능 (10^6 = 100만 조합)
- **조치:** `@limiter.limit("10/minute")` 등 Rate Limit 추가

### 5. 비밀번호 재설정 코드 메모리 저장
**위치:** `_password_reset_codes` (in-memory dict)

- **문제:** 서버 재시작 시 모든 코드 무효화. 다중 인스턴스 환경에서 공유 불가
- **조치:** Redis 또는 DB에 저장 (만료 시간 포함)

### 6. NEXTAUTH_SECRET 개발용 기본값
**위치:** `apps/web_new/app/api/auth/[...nextauth]/route.ts`

- **문제:** `NEXTAUTH_SECRET` 미설정 시 `'dev-secret-change-in-production'` 사용
- **조치:** 프로덕션에서는 미설정 시 undefined로 두어 오류 발생시키기 (이미 일부 적용됨)

### 7. CORS allow_origins 빈 값 시 동작
**위치:** `apps/admin/app/main.py`

- **문제:** `ALLOWED_ORIGINS`가 빈 문자열이면 `[]` → 모든 Origin 차단. 설정 오타 시 서비스 장애
- **조치:** 배포 체크리스트에 CORS 설정 검증 추가

---

## 🟡 Medium (점진적 개선)

### 8. 쿠키 보안 옵션
- **문제:** `SECRET_TOKEN` 쿠키에 `HttpOnly`, `Secure`, `SameSite` 설정 확인 필요
- **조치:** `auth.py` 로그인 응답 시 `set_cookie(..., httponly=True, secure=True, samesite='lax')` 적용

### 9. JWT Refresh Token 저장
- **문제:** Refresh Token이 DB에 저장되나, 탈취 시 장기 악용 가능
- **조치:** Refresh Token 로테이션, 블랙리스트(로그아웃 시) 적용 검토

### 10. 로그인 실패 횟수 제한
- **문제:** 로그인 API에 계정 잠금/시도 제한 없음
- **조치:** IP 또는 이메일별 실패 횟수 제한 후 일시 잠금

### 11. 민감 정보 로깅
- **문제:** 일부 `print` 로그에 민감 정보 노출 가능성
- **조치:** 프로덕션에서는 구조화된 로깅 사용, 민감 필드 마스킹

---

## 🟢 양호한 점

- SQL Injection: SQLAlchemy ORM·파라미터 바인딩 사용, raw SQL은 마이그레이션용으로만 사용
- `eval`/`exec` 등 위험 함수 미사용
- 비밀번호 bcrypt 해싱 (`utils.get_password_hash`)
- 보안 헤더 적용 (X-Content-Type-Options, X-XSS-Protection, HSTS, Referrer-Policy)
- Rate limiting (SlowAPI) - 일부 엔드포인트에 적용
- JWT Access Token 1시간 만료

---

## 권장 조치 순서

1. **비밀번호 재설정 이메일 발송 구현** (Critical)
2. **프로덕션 시크릿/API 키 환경 변수 필수화** (Critical)
3. **XSS 방지 - HTML 새니타이즈** (Critical)
4. **비밀번호 재설정 Rate Limit + 코드 저장소 개선** (High)
