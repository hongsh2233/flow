import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 참여자별 주식 대차거래내역 - BO /api/stck-lnb-invpn-detail 경유
 * itms_nm(종목명), bas_dt, isin_cd로 검색 가능
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => params.append(key, value));

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(`${API_BASE_URL}/api/stck-lnb-invpn-detail?${params}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || "조회 실패", data: [] }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.warn("참여자별 대차거래 조회 실패:", e);
    return NextResponse.json({ error: "조회 중 오류 발생", data: [] }, { status: 500 });
  }
}
