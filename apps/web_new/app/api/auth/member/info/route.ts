import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (!API_BASE_URL) {
      return NextResponse.json(
        { success: false, message: "API 설정이 없습니다.", point_balance: 0 },
        { status: 503 }
      );
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const url = `${API_BASE_URL}/api/auth/member/info?email=${encodeURIComponent(session.user.email)}`;
    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[auth/member/info]", e);
    return NextResponse.json({ success: false, message: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
