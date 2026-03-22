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
 * 서버가 자기 자신에게 HTTP 요청할 때 사용할 베이스 URL.
 * Railway/Render 등은 TLS가 엣지에서 종료되므로, 공개 https URL로 다시 fetch 하면
 * ERR_SSL_PACKET_LENGTH_TOO_LONG 등 TLS 오류가 날 수 있음 → 루프백 HTTP 사용.
 * Vercel 서버리스는 루프백이 맞지 않으므로 공개 origin 유지.
 */
function getServerSelfFetchBases(request: NextRequest): {
  fetchBase: string;
  publicOrigin: string;
} {
  const publicOrigin = request.nextUrl.origin;

  const explicit = process.env.INTERNAL_FETCH_ORIGIN?.replace(/\/$/, "");
  if (explicit) {
    return { fetchBase: explicit, publicOrigin };
  }

  const onVercel = !!process.env.VERCEL;
  const onContainer =
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_PUBLIC_DOMAIN ||
    !!process.env.RENDER ||
    !!process.env.FLY_APP_NAME;

  if (!onVercel && onContainer) {
    const port = process.env.PORT || "3000";
    return { fetchBase: `http://127.0.0.1:${port}`, publicOrigin };
  }

  return { fetchBase: publicOrigin, publicOrigin };
}

/** NextAuth가 공개 호스트를 알 수 있도록 프록시 헤더 전달 */
function selfFetchHeaders(request: NextRequest, cookieFromClient: string): HeadersInit {
  const h: Record<string, string> = {};
  if (cookieFromClient) h["Cookie"] = cookieFromClient;

  const xfh = request.headers.get("x-forwarded-host");
  const host = xfh || request.headers.get("host");
  const xfp = request.headers.get("x-forwarded-proto");
  if (host) h["x-forwarded-host"] = host;
  if (xfp) h["x-forwarded-proto"] = xfp;
  else if (host) h["x-forwarded-proto"] = "https";

  return h;
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

  const { fetchBase, publicOrigin } = getServerSelfFetchBases(request);

  try {
    const cookieFromClient = request.headers.get("cookie") || "";
    const forwardHeaders = selfFetchHeaders(request, cookieFromClient);

    const csrfRes = await fetch(`${fetchBase}/api/auth/csrf`, {
      cache: "no-store",
      headers: forwardHeaders,
    });

    const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
    if (!csrfToken) {
      console.error("[get-oauth-url] csrfToken 없음");
      return NextResponse.json({ error: "OAuth URL을 가져오지 못했습니다." }, { status: 500 });
    }

    const csrfPair = extractNextAuthCsrfCookiePair(getSetCookieLines(csrfRes));
    const cookieForSignin = mergeCookieHeader(cookieFromClient, csrfPair);

    const signinRes = await fetch(`${fetchBase}/api/auth/signin/${provider}`, {
      method: "POST",
      headers: {
        ...forwardHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(cookieForSignin ? { Cookie: cookieForSignin } : {}),
      },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
      redirect: "manual",
    });

    let oauthUrl = signinRes.headers.get("location");
    if (oauthUrl?.startsWith("/")) {
      oauthUrl = `${publicOrigin}${oauthUrl}`;
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
