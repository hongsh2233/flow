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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
