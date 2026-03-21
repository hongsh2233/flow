import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { shouldShowAdZoneAServer } from "@/lib/affiliate/adZoneA";

/**
 * 광고설정(알리익스프레스 등) 상품 목록 — BO 프록시
 * A구역: VIP·Family 세션에는 빈 목록 (클라이언트 우회 방지)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!shouldShowAdZoneAServer(session)) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    if (!API_BASE_URL) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }
    const res = await fetch(`${API_BASE_URL}/api/affiliate-products`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }
    const body = await res.json();
    return NextResponse.json(body);
  } catch (e) {
    console.error("[affiliate-products]", e);
    return NextResponse.json({ success: true, data: [], count: 0 });
  }
}
