import { NextRequest, NextResponse } from "next/server";

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * 모바일 앱(Capacitor)에서 소셜 OAuth URL을 얻기 위한 서버 사이드 엔드포인트.
 * Chrome Custom Tab에서 열기 위해 OAuth 인증 URL을 반환한다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") || "/auth/mobile-callback";

  if (!["google", "naver"].includes(provider)) {
    return NextResponse.json({ error: "지원하지 않는 provider입니다." }, { status: 400 });
  }

  try {
    // 서버 사이드에서 CSRF 토큰 획득
    const csrfRes = await fetch(`${NEXTAUTH_URL}/api/auth/csrf`, {
      cache: "no-store",
    });
    const { csrfToken } = await csrfRes.json();

    // NextAuth sign-in 엔드포인트에 POST → OAuth 리다이렉트 URL 획득
    const signinRes = await fetch(`${NEXTAUTH_URL}/api/auth/signin/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
      redirect: "manual", // 리다이렉트를 따라가지 않고 Location 헤더 추출
    });

    const oauthUrl = signinRes.headers.get("location");

    if (!oauthUrl) {
      return NextResponse.json({ error: "OAuth URL을 가져오지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ url: oauthUrl });
  } catch (error) {
    console.error("[get-oauth-url] 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
