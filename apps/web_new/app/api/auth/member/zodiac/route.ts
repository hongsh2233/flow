import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const VALID_ANIMALS = new Set(["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"]);
const VALID_SIGNS = new Set([
  "양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리",
  "천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리",
]);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "로그인 후 이용 가능합니다." }, { status: 401 });
    }
    const headers: Record<string, string> = {};
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const url = new URL(`${API_BASE_URL}/api/auth/member/zodiac`);
    url.searchParams.set("email", session.user.email);
    const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.detail ?? "띠/별자리 조회 실패" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("띠/별자리 조회 오류:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "로그인 후 이용 가능합니다." }, { status: 401 });
    }
    const body = await request.json();
    const zodiac_animal = body?.zodiac_animal as string | undefined;
    const zodiac_sign = body?.zodiac_sign as string | undefined;
    if (!zodiac_animal && !zodiac_sign) {
      return NextResponse.json({ success: false, message: "zodiac_animal 또는 zodiac_sign 중 하나는 필수입니다." }, { status: 400 });
    }
    if (zodiac_animal && !VALID_ANIMALS.has(zodiac_animal)) {
      return NextResponse.json({ success: false, message: "유효한 띠가 아닙니다." }, { status: 400 });
    }
    if (zodiac_sign && !VALID_SIGNS.has(zodiac_sign)) {
      return NextResponse.json({ success: false, message: "유효한 별자리가 아닙니다." }, { status: 400 });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const response = await fetch(`${API_BASE_URL}/api/auth/member/zodiac`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ email: session.user.email, zodiac_animal, zodiac_sign }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.detail ?? "띠/별자리 저장 실패" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("띠/별자리 저장 오류:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
