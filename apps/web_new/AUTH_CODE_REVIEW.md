# 인증 관련 코드 점검 보고서

## 1. 로그인

### ✅ 정상 동작
- **이메일/비밀번호 로그인**: NextAuth CredentialsProvider → BO `/api/auth/member/login` 호출
- **에러 처리**: `result?.error` 시 "이메일 또는 비밀번호를 확인해주세요." 표시
- **성공 시**: `router.push("/")`, `localStorage`에 최근 로그인 수단 저장
- **아이디/비밀번호 찾기** 링크 연결

### ⚠️ 참고
- `remember`(로그인 상태 유지) 체크박스: UI만 있고, NextAuth `maxAge` 등 세션 유지 시간과 연동되어 있지 않음
- NextAuth 기본 세션 만료 시간에 따름

---

## 2. 회원가입 / 아이디·비밀번호 찾기

### 회원가입

| 항목 | 상태 | 비고 |
|------|------|------|
| 닉네임 | ⚠️ readOnly | 수정 예정: 직접 입력 가능하게 변경 |
| 이메일 중복확인 | ✅ | `/api/auth/check-email` 프록시 사용 |
| 비밀번호 검증 | ✅ | 8자 이상, 확인 일치 |
| 약관 동의 | ✅ | 약관 보기 → 동의 시에만 가입 가능 |
| 회원가입 API | ✅ | `/api/auth/member/signup` 프록시 |
| 자동 로그인 | ✅ | 가입 후 `signIn("credentials")` 호출 |

### 아이디 찾기

| 항목 | 상태 |
|------|------|
| 닉네임 입력 | ✅ |
| BO API 연동 | ✅ 닉네임 기준 검색, 이메일 마스킹 |
| 프록시 | ✅ `/api/auth/member/find-email` |

### 비밀번호 찾기

| 항목 | 상태 | 비고 |
|------|------|------|
| 이메일 입력 → 인증코드 발송 | ✅ | |
| 인증코드 + 새 비밀번호 입력 | ✅ | |
| BO 인증코드 저장 | ⚠️ 메모리 | 서버 재시작 시 초기화됨 (프로덕션에서는 Redis/DB 권장) |
| 비밀번호 변경 API | ✅ | `/api/auth/member/reset-password` |

---

## 3. 소셜 로그인/가입

### NextAuth JWT 콜백 흐름

1. OAuth 인증 완료 (Kakao/Naver/Google)
2. BO `POST /api/auth/social-login` 호출
3. 응답의 `nickname`, `profile_image`로 세션 갱신

### BO social-login 처리

- **기존 회원**: 이메일 또는 provider+provider_id로 조회 후 정보 업데이트
- **신규 회원**: `generate_profile()`로 닉네임·프로필 이미지 생성 후 등록

### 소셜 가입 (회원가입 페이지)

- 약관 동의 후 소셜 버튼 클릭 시 `signIn(provider)` 호출
- 미동의 시 약관 모달 → 동의 후 소셜 로그인 진행

### ⚠️ 확인 필요

1. **OAuth 이메일 없음**: Kakao 일부 계정은 이메일 미제공 가능 → BO `SocialLoginRequest.email`이 빈 문자열일 수 있음
2. **provider별 환경 변수**:
   - Naver: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
   - Kakao: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
   - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## 4. 기타

### 프로필 수정 (settings/profile)

- 프로필 이미지 변경: BO API 연동 ✅
- 세션 갱신: `updateSession()` 사용 ✅
- 비밀번호 변경: `TODO` 상태, 실제 API 미연동

### LayoutShell / 최근 로그인

- 세션의 `lastLoginProvider`를 `localStorage`에 저장 ✅
- 로그인 페이지에서 "최근 로그인" 배지 표시 ✅

---

## 5. 보안 점검 (적용 사항)

- **회원가입 서버 검증**: BO `MemberSignupRequest`에 이메일 형식·길이, 비밀번호 8자 이상·128자 이하 검증 추가 (Pydantic `field_validator`).
- **비밀번호 재설정 응답**: 프로덕션에서는 응답에 인증코드(`code`)를 넣지 않음. 개발 시에만 `PASSWORD_RESET_DEBUG=1` 환경 변수로 코드 노출.
- **카카오 가입/로그인**: 비활성화 (NextAuth KakaoProvider 주석, 로그인/회원가입 화면 카카오 버튼 주석, BO social-login에서 `kakao` provider 미허용).

### 참고 (추가 권장)

- **비밀번호 재설정 코드**: 프로덕션에서는 Redis/DB 저장 및 이메일 발송 연동 권장.
- **회원 정보/관심종목 API**: `email` 파라미터로 조회·수정 시, 호출자가 해당 회원 본인인지 토큰/세션으로 검증하는 것이 좋음.
- **회원가입/비밀번호 찾기**: 과도한 요청 방지를 위한 rate limiting 적용 권장.

---

## 6. 수정 권장 사항

1. **회원가입 닉네임**: `readOnly` 제거, `onChange` 연결, 닉네임 필수 검증
2. **비밀번호 변경 (프로필)**: BO 비밀번호 변경 API 연동
3. **비밀번호 재설정 코드**: 프로덕션에서는 Redis/DB 저장 검토
