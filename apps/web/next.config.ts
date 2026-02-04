import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// 루트(jurin-i) .env.local 로드 — web·admin 공용
// apps/web에서 실행 시 ../../.env.local, 루트에서 실행 시 .env.local
// dotenv가 없어도 동작하도록 try-catch로 처리
try {
  const dotenv = require("dotenv");
  const rootEnvLocal = path.resolve(process.cwd(), "../../.env.local");
  const rootEnvLocalAlt = path.resolve(process.cwd(), ".env.local");
  
  // 파일이 존재하는 경우에만 로드
  if (fs.existsSync(rootEnvLocal)) {
    dotenv.config({ path: rootEnvLocal });
  }
  if (fs.existsSync(rootEnvLocalAlt)) {
    dotenv.config({ path: rootEnvLocalAlt });
  }
} catch (error) {
  // dotenv가 설치되지 않은 경우 무시 (Next.js가 기본적으로 .env.local을 로드함)
  console.warn("dotenv 모듈을 찾을 수 없습니다. Next.js 기본 환경 변수 로딩을 사용합니다.");
}

const nextConfig: NextConfig = {
  /* config options here */
  compiler: {
    // Production 빌드 시 console.log, console.info, console.debug 제거
    removeConsole: process.env.NODE_ENV === 'production'
      ? {
          exclude: ['error', 'warn'], // error와 warn은 유지
        }
      : false,
  },
};

export default nextConfig;
