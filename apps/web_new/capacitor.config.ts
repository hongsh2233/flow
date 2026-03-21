import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jurini.app",
  appName: "플로우",
  // 정적 빌드 경로 (npx next export 결과물)
  webDir: "out",
  // 배포 서버 URL 모드: Railway 배포 주소를 아래에 설정
  // 로컬 개발 시 server.url을 주석 처리하면 webDir 빌드 파일 사용
  server: {
    // Railway 배포 URL - 환경에 따라 변경
    // url: "https://your-app.railway.app",
    // Android에서 HTTP 허용 (개발용, 운영은 HTTPS 사용)
    cleartext: false,
    androidScheme: "https",
    // 소셜 로그인 OAuth 콜백을 위한 허용 도메인 (Chrome Custom Tab 쿠키 공유)
    allowNavigation: [
      "accounts.google.com",
      // "nid.naver.com", // 네이버 로그인 비활성화
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#1a3a5c",
      showSpinner: false,
    },
  },
  android: {
    // 빌드 타겟 API 레벨
    minWebViewVersion: 60,
  },
};

export default config;
