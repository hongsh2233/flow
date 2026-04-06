"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Google OAuth 시작 브릿지 (모바일 Custom Tab / 일반 웹 공통 권장).
 * 클라이언트 signIn()만 쓰면 state 쿠키가 안 남아 OAuthCallbackError(State cookie was missing)가 날 수 있어,
 * CSRF를 받은 뒤 동일 출처 폼 POST로 /api/auth/signin/:provider 를 호출해
 * NextAuth가 Set-Cookie(state) 후 Google로 리다이렉트하도록 한다.
 */
function OauthBridgeInner() {
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") || "google";
  const callbackUrl = searchParams.get("callbackUrl") || "/auth/mobile-callback";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (provider !== "google") {
        setError("지원하지 않는 로그인 방식입니다.");
        return;
      }

      const safeCallback =
        callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/auth/mobile-callback";

      try {
        const csrfRes = await fetch("/api/auth/csrf", {
          credentials: "include",
          cache: "no-store",
        });
        if (!csrfRes.ok) throw new Error("csrf fetch failed");
        const data = (await csrfRes.json()) as { csrfToken?: string };
        const csrfToken = data.csrfToken;
        if (!csrfToken || cancelled) return;

        const form = document.createElement("form");
        form.method = "POST";
        form.action = `/api/auth/signin/${provider}`;
        const csrfInput = document.createElement("input");
        csrfInput.name = "csrfToken";
        csrfInput.value = csrfToken;
        const cbInput = document.createElement("input");
        cbInput.name = "callbackUrl";
        cbInput.value = safeCallback;
        form.appendChild(csrfInput);
        form.appendChild(cbInput);
        document.body.appendChild(form);
        form.submit();
      } catch {
        if (!cancelled) {
          setError("로그인 준비에 실패했습니다. 이 화면을 닫고 앱에서 다시 시도해주세요.");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [provider, callbackUrl]);

  if (error) {
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
          background: "#fef2f2",
          color: "#991b1b",
        }}
      >
        <p style={{ maxWidth: 320 }}>{error}</p>
      </div>
    );
  }

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
        color: "#475569",
      }}
    >
      <p style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Google 로그인으로 연결하는 중…</p>
      <p style={{ fontSize: "0.875rem" }}>잠시만 기다려 주세요.</p>
    </div>
  );
}

export default function OauthBridgePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "sans-serif",
            color: "#64748b",
          }}
        >
          준비 중…
        </div>
      }
    >
      <OauthBridgeInner />
    </Suspense>
  );
}
