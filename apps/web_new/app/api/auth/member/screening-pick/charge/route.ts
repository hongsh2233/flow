import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ detail: "로그인이 필요합니다." }, { status: 401 });
    }
    if (!API_BASE_URL) {
      return NextResponse.json({ detail: "API 설정이 없습니다." }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const stock_code = typeof body.stock_code === "string" ? body.stock_code.trim() : "";
    const screening_date = typeof body.screening_date === "string" ? body.screening_date.trim() : "";
    const screening_type = typeof body.screening_type === "string" ? body.screening_type.trim().toLowerCase() : "";
    const rank = typeof body.rank === "number" ? body.rank : parseInt(String(body.rank ?? ""), 10);
    if (!stock_code || !screening_date || !screening_type || !Number.isFinite(rank) || rank < 1) {
      return NextResponse.json({ detail: "stock_code, rank, screening_date, screening_type가 필요합니다." }, { status: 400 });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const res = await fetch(`${API_BASE_URL}/api/auth/member/screening-pick/charge`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        email: session.user.email,
        stock_code,
        rank,
        screening_date,
        screening_type,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[screening-pick/charge]", e);
    return NextResponse.json({ detail: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
