import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { shouldShowAdZoneAServer } from "@/lib/affiliate/adZoneA";
import { shouldShowAdZoneB_regularServer, shouldShowAdZoneB_vipServer } from "@/lib/affiliate/adZoneB";

/**
 * 광고설정(알리익스프레스 등) 상품 목록 — BO 프록시
 * zone=A (기본): A구역 — VIP·Family 미노출
 * zone=B: B구역 — Family만 미노출 (VIP까지 노출)
 */
export async function GET(req: NextRequest) {
  try {
    const zone = req.nextUrl.searchParams.get("zone") ?? "A";
    const session = await getServerSession(authOptions);

    // 구역별 노출 권한 확인
    if (zone === "B") {
      if (!shouldShowAdZoneB_vipServer(session)) {
        return NextResponse.json({ success: true, data: [], count: 0 });
      }
    } else {
      if (!shouldShowAdZoneAServer(session)) {
        return NextResponse.json({ success: true, data: [], count: 0 });
      }
    }

    if (!API_BASE_URL) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }
    const res = await fetch(`${API_BASE_URL}/api/affiliate-products?zone=${zone}`, {
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
