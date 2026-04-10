"use client";

import { useEffect } from "react";
import { MOBILE_AUTH_CALLBACK_URL } from "@/lib/config/mobileAppAuth";

/**
 * 모바일 앱(Capacitor / JurinApp WebView)의 소셜 로그인 콜백 페이지.
 * Chrome Custom Tab에서 OAuth가 완료된 후 이 페이지가 열린다.
 *
 * Chrome Custom Tab과 WebView는 쿠키를 공유하지 않으므로,
 * raw JWT를 서버에서 가져와 deep link URL에 포함시킨다.
 * Android 앱이 이 토큰을 받아 WebView의 CookieManager에 설정한다.
 */
export default function MobileCallbackPage() {
  useEffect(() => {
    async function redirectToApp() {
      try {
        // Chrome Custom Tab에는 세션 쿠키가 있으므로 이 요청은 인증됨
        const res = await fetch("/api/auth/get-session-token");
        if (res.ok) {
          const { sessionToken } = await res.json();
          if (sessionToken) {
            window.location.href = `${MOBILE_AUTH_CALLBACK_URL}?token=${encodeURIComponent(sessionToken)}`;
            return;
          }
        }
      } catch {
        // 토큰 획득 실패 시 토큰 없이 deep link (fallback)
      }
      window.location.href = MOBILE_AUTH_CALLBACK_URL;
    }

    redirectToApp();

    // 딥링크 미지원 환경(일반 브라우저) 대비 fallback
    const timer = setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "sans-serif",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          background: "#22c55e",
          borderRadius: "50%",
          width: 64,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 6L9 17L4 12"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
        로그인 성공!
      </h1>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
        앱으로 자동으로 돌아갑니다.
      </p>
      <button
        onClick={() => window.close()}
        style={{
          background: "#1a3a5c",
          color: "white",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.75rem 2rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        앱으로 돌아가기
      </button>
    </div>
  );
}
