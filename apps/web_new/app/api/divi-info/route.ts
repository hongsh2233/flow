import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 주식배당정보 조회 - BO /api/divi-info 경유
 * bas_dt, crno, stck_issu_cmpy_nm 등
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      params.append(key, value);
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/divi-info?${params.toString()}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || "배당정보 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn("배당정보 조회 실패:", error);
    return NextResponse.json(
      { error: "배당정보 조회 중 오류가 발생했습니다.", data: [] },
      { status: 500 }
    );
  }
}
