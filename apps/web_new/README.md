# 플로우 — 프론트엔드 (apps/web_new)

Next.js 16 + React 19 기반 사용자 앱. 웹 브라우저 및 Android(Capacitor) 지원.

## 실행

```bash
# 프로젝트 루트의 .env.local 설정 후
cd apps/web_new
npm install
npm run dev   # http://localhost:3000
```

## 환경 변수

루트의 `.env.local` 사용 (상세: 루트 `README.md` 참고).

프론트엔드에서 필요한 주요 변수:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_X_API_KEY=your-api-key
# 선택: 모바일 웹 앱 다운로드 모달 링크 (미설정 시 Google Drive 기본값)
# NEXT_PUBLIC_APP_DOWNLOAD_URL=https://drive.google.com/file/d/.../view
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

## 빌드 및 배포

```bash
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 실행
```

Capacitor APK 빌드: 루트 `CAPACITOR_SETUP.md` 참고.
