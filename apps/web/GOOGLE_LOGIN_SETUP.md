# 구글 로그인 구현 가이드

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 OAuth 동의 화면 설정

1. "API 및 서비스" > "OAuth 동의 화면" 이동
2. 사용자 유형 선택 (외부 또는 내부)
3. 앱 정보 입력:
   - 앱 이름: "주리니"
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일
4. 범위 추가 (선택사항):
   - `openid`
   - `email`
   - `profile`
5. 테스트 사용자 추가 (개발 단계)

### 1.3 OAuth 2.0 클라이언트 ID 생성

1. "API 및 서비스" > "사용자 인증 정보" 이동
2. "+ 사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" 선택
3. 애플리케이션 유형: "웹 애플리케이션"
4. 이름: "주리니 웹 클라이언트"
5. 승인된 리디렉션 URI 추가:
   - 개발: `http://localhost:3000/api/auth/callback/google`
   - 프로덕션: `https://yourdomain.com/api/auth/callback/google`
6. "만들기" 클릭
7. **Client ID**와 **Client Secret** 복사 (나중에 환경 변수로 사용)

## 2. 필요한 패키지 설치

### 방법 A: NextAuth.js 사용 (추천)

```bash
npm install next-auth@beta
```

### 방법 B: 직접 구현

```bash
npm install google-auth-library
```

## 3. 환경 변수 설정

`.env.local` 파일에 추가:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-here
```

**NEXTAUTH_SECRET 생성 방법:**

```bash
openssl rand -base64 32
```

## 4. 구현 방법

### 방법 A: NextAuth.js 사용 시

- `/app/api/auth/[...nextauth]/route.ts` 생성 필요
- NextAuth 설정 파일 생성
- 로그인 페이지에서 NextAuth 세션 사용

### 방법 B: 직접 구현 시

- `/app/api/auth/google/route.ts` - 구글 로그인 시작
- `/app/api/auth/callback/google/route.ts` - 구글 콜백 처리
- 구글 OAuth 2.0 플로우 직접 구현

## 5. 보안 고려사항

1. **환경 변수 보호**

   - `.env.local`은 절대 Git에 커밋하지 않기
   - `.gitignore`에 포함 확인

2. **HTTPS 사용**

   - 프로덕션에서는 반드시 HTTPS 사용
   - Google OAuth는 HTTPS를 요구함

3. **리디렉션 URI 검증**

   - Google Cloud Console에서 정확한 URI 등록
   - 잘못된 URI는 보안 위험

4. **토큰 관리**
   - Access Token은 안전하게 저장
   - Refresh Token은 서버에만 저장 (가능한 경우)

## 6. 테스트 체크리스트

- [ ] Google Cloud Console에서 OAuth 동의 화면 설정 완료
- [ ] OAuth 2.0 클라이언트 ID 생성 완료
- [ ] 환경 변수 설정 완료
- [ ] 로그인 버튼 클릭 시 Google 로그인 페이지로 이동
- [ ] 로그인 성공 후 리디렉션 동작 확인
- [ ] 사용자 정보 (이메일, 이름 등) 가져오기 확인
- [ ] 로그아웃 기능 동작 확인
