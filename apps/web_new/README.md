This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1. 환경 변수 설정

먼저 공공데이터포털 API 키를 설정해야 합니다:

```bash
# .env.local 파일 생성
cp .env.local.example .env.local
```

`.env.local` 파일을 열어 아래 내용을 설정하세요:

```
DATA_GO_KR_API_KEY=your_decoded_api_key_here
```

**API 키 발급 방법:**
1. [공공데이터포털](https://www.data.go.kr/) 회원가입 및 로그인
2. 필요한 API 활용신청:
   - [주식시세정보](https://www.data.go.kr/data/15094808/openapi.do)
   - [기업 기본정보](https://www.data.go.kr/data/15043459/openapi.do)
3. 마이페이지 > 인증키 발급현황에서 **디코딩된 인증키** 복사

⚠️ **주의**: 일반 인증키(URL Encode)가 아닌 **디코딩된 인증키**를 사용해야 합니다.

### 2. 개발 서버 실행

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Railway

이 프로젝트는 Railway에 배포됩니다. 배포 가이드는 프로젝트 루트의 [RAILWAY_DEPLOY.md](../../RAILWAY_DEPLOY.md)를 참고하세요.

### Railway 배포 요약

1. Railway 프로젝트 생성
2. PostgreSQL 데이터베이스 추가
3. Admin 서비스 추가 (Root Directory: `apps/admin`)
4. Web 서비스 추가 (Root Directory: `apps/web`)
5. 환경 변수 설정 (자세한 내용은 [README_ENV.md](./README_ENV.md) 참고)
