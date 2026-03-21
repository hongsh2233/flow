import { NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 광고설정(알리익스프레스 등) 상품 목록 — BO 프록시
 */
export async function GET() {
  try {
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
