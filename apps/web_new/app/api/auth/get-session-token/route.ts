import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * 모바일 앱(JurinApp WebView)에서 Chrome Custom Tab OAuth 완료 후
 * 세션 토큰을 deep link로 전달하기 위해 raw JWT를 반환하는 엔드포인트.
 *
 * Chrome Custom Tab과 WebView는 쿠키를 공유하지 않으므로,
 * mobile-callback 페이지가 이 엔드포인트로 토큰을 받아
 * deep link에 포함시켜 Android 앱에 전달한다.
 */
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, raw: true });
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }
  return NextResponse.json({ sessionToken: token });
}
