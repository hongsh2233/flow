import { NextRequest, NextResponse } from "next/server";

/** Node/Undici: Set-Cookie는 get("set-cookie")로 읽히지 않는 경우가 많아 getSetCookie를 우선 사용 */
function getSetCookieLines(res: Response): string[] {
  const headers = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/** NextAuth CSRF 쿠키 한 쌍(name=value) 추출 */
function extractNextAuthCsrfCookiePair(setCookieLines: string[]): string {
  for (const line of setCookieLines) {
    const nameValue = line.split(";")[0]?.trim();
    if (!nameValue || !nameValue.includes("=")) continue;
    const eq = nameValue.indexOf("=");
    const name = nameValue.slice(0, eq).trim();
    if (name.includes("csrf-token") && name.includes("auth")) {
      return nameValue;
    }
  }
  return "";
}

function mergeCookieHeader(existing: string, additionalPair: string): string {
  if (!additionalPair) return existing;
  if (!existing) return additionalPair;
  return `${existing}; ${additionalPair}`;
}

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

  if (!["google"].includes(provider)) {
    return NextResponse.json({ error: "지원하지 않는 provider입니다." }, { status: 400 });
  }

  // 현재 요청 오리진 사용 → Railway 등에서 NEXTAUTH_URL 오설정이어도 자기 자신에게 fetch
  const origin = request.nextUrl.origin;

  try {
    const cookieFromClient = request.headers.get("cookie") || "";

    const csrfRes = await fetch(`${origin}/api/auth/csrf`, {
      cache: "no-store",
      headers: cookieFromClient ? { Cookie: cookieFromClient } : {},
    });

    const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
    if (!csrfToken) {
      console.error("[get-oauth-url] csrfToken 없음");
      return NextResponse.json({ error: "OAuth URL을 가져오지 못했습니다." }, { status: 500 });
    }

    const csrfPair = extractNextAuthCsrfCookiePair(getSetCookieLines(csrfRes));
    const cookieForSignin = mergeCookieHeader(cookieFromClient, csrfPair);

    const signinRes = await fetch(`${origin}/api/auth/signin/${provider}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(cookieForSignin ? { Cookie: cookieForSignin } : {}),
      },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
      redirect: "manual",
    });

    let oauthUrl = signinRes.headers.get("location");
    if (oauthUrl?.startsWith("/")) {
      oauthUrl = `${origin}${oauthUrl}`;
    }

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
