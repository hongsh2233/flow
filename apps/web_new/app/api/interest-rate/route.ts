import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 금리 - Yahoo Finance on-demand 조회 (백엔드 1시간 캐시)
 */
export async function GET(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/interest-rate`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "금리 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error("Interest Rate API Error:", error);
    return NextResponse.json(
      { success: false, message: "금리 정보를 가져오는데 실패했습니다.", data: [] },
      { status: 500 }
    );
  }
}
