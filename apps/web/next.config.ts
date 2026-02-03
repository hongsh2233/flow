import type { NextConfig } from "next";
import path from "path";

// 루트(jurin-i) .env.local 로드 — web·admin 공용
// apps/web에서 실행 시 ../../.env.local, 루트에서 실행 시 .env.local
const rootEnvLocal =
  path.resolve(process.cwd(), "../../.env.local");
const rootEnvLocalAlt = path.resolve(process.cwd(), ".env.local");
require("dotenv").config({ path: rootEnvLocal });
require("dotenv").config({ path: rootEnvLocalAlt });

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
