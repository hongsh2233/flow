import type { NextConfig } from "next";

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
