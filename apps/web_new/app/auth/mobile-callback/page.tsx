"use client";

import { useEffect } from "react";

/**
 * Capacitor 모바일 앱의 소셜 로그인 콜백 페이지.
 * Chrome Custom Tab에서 OAuth가 완료된 후 이 페이지가 열린다.
 * 쿠키에 세션이 설정되었으므로 브라우저를 닫으면 WebView에서 로그인 상태가 반영된다.
 */
export default function MobileCallbackPage() {
  useEffect(() => {
    // Chrome Custom Tab은 window.close()로 닫을 수 없음 (네이티브로 열렸기 때문).
    // 딥링크로 앱을 호출하면 OS가 앱을 포그라운드로 전환하고 Custom Tab을 자동으로 닫는다.
    window.location.href = "com.jurini.app://auth/callback";

    // 딥링크 미지원 환경(일반 브라우저) 대비 fallback
    const timer = setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 1500);
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
