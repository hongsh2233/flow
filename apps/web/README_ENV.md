# 환경 변수 설정 가이드

## .env.local 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# API 설정
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_API_BASE_URL=https://stock-bo-production.up.railway.app

# NextAuth (Railway 배포 시 필수)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=랜덤문자열_32자이상

# 소셜 로그인 (선택)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NAVER_CLIENT_LOGIN_ID=...
NAVER_CLIENT_LOGIN_SECRET=...
NEXT_PUBLIC_X_API_KEY=...
```

## 환경 변수 설명

- `NEXT_PUBLIC_USE_MOCK_DATA`: 목업 데이터 사용 여부 (true/false)
- `NEXT_PUBLIC_API_BASE_URL`: 실제 API 서버 URL
- `NEXTAUTH_URL`: NextAuth 기준 URL (로컬: `http://localhost:3000`, Railway: `https://your-app.railway.app`)
- `NEXTAUTH_SECRET`: 세션/토큰 암호화용 비밀키 (32자 이상 랜덤 문자열 권장)

## Railway 배포 시 (CLIENT_FETCH_ERROR 해결)

Railway 대시보드 → Web 서비스 → **Variables** 탭에서 다음을 반드시 설정하세요:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXTAUTH_URL` | `https://your-app.railway.app` | Railway가 제공하는 배포된 사이트 URL |
| `NEXTAUTH_SECRET` | 32자 이상 랜덤 문자열 | `openssl rand -base64 32` 로 생성 가능 |
| `NEXT_PUBLIC_API_BASE_URL` | `https://admin-service.railway.app` | Admin 서비스의 Railway URL |

- `NEXTAUTH_URL`은 Railway가 자동으로 제공하는 `RAILWAY_PUBLIC_DOMAIN` 환경 변수를 사용하거나, 커스텀 도메인을 설정한 경우 해당 URL을 사용하세요.
- `NEXTAUTH_SECRET`이 없으면 프로덕션에서 세션/쿠키 서명이 실패해 `/api/auth/session` 호출 시 오류가 납니다.
- `NEXT_PUBLIC_API_BASE_URL`은 Admin 서비스의 Railway URL을 설정해야 합니다.

설정 후 서비스를 재배포하세요.

## 주의사항

- `.env.local` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.
- 환경 변수 변경 후 개발 서버를 재시작해야 합니다.
- `NEXT_PUBLIC_` 접두사가 붙은 변수만 클라이언트에서 사용 가능합니다.

