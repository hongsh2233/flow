import { NextRequest, NextResponse } from "next/server";

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * 모바일 앱(Capacitor / JurinApp WebView)에서 소셜 OAuth URL을 얻기 위한 서버 사이드 엔드포인트.
 * Chrome Custom Tab에서 열기 위해 OAuth 인증 URL을 반환한다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") || "/auth/mobile-callback";

  // 네이버 OAuth 비활성화 — 기존: ["google", "naver"]
  if (!["google"].includes(provider)) {
    return NextResponse.json({ error: "지원하지 않는 provider입니다." }, { status: 400 });
  }

  try {
    // 서버 사이드에서 CSRF 토큰 획득
    const csrfRes = await fetch(`${NEXTAUTH_URL}/api/auth/csrf`, {
      cache: "no-store",
    });
    const { csrfToken } = await csrfRes.json();

    // NextAuth CSRF 검증: signin POST에 csrf-token 쿠키도 함께 전달해야 함.
    // 쿠키 없이 csrfToken만 보내면 NextAuth가 로그인 페이지로 리다이렉트한다.
    const setCookieHeader = csrfRes.headers.get("set-cookie") || "";
    const csrfCookieMatch = setCookieHeader.match(/next-auth\.csrf-token=[^;]+/);
    const csrfCookieValue = csrfCookieMatch ? csrfCookieMatch[0] : "";

    // NextAuth sign-in 엔드포인트에 POST → OAuth 리다이렉트 URL 획득
    const signinRes = await fetch(`${NEXTAUTH_URL}/api/auth/signin/${provider}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(csrfCookieValue ? { Cookie: csrfCookieValue } : {}),
      },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
      redirect: "manual", // 리다이렉트를 따라가지 않고 Location 헤더 추출
    });

    const oauthUrl = signinRes.headers.get("location");

    // 반환된 URL이 실제 Google OAuth URL인지 확인 (CSRF 실패 시 로그인 페이지 URL이 올 수 있음)
    if (!oauthUrl || !oauthUrl.startsWith("https://accounts.google.com")) {
      console.error("[get-oauth-url] 유효하지 않은 OAuth URL:", oauthUrl, "status:", signinRes.status);
      return NextResponse.json({ error: "OAuth URL을 가져오지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ url: oauthUrl });
  } catch (error) {
    console.error("[get-oauth-url] 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
