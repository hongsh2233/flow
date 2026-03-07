import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 아침 시장 요약 - 뉴욕 마감, 나스닥 선물, 코스피200, 환율
 * 06:35 KST 스케줄러가 수집한 데이터
 */
export async function GET(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/market-morning-summary`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, data: { indices: [], exchangeRates: [], collectedDate: null } },
        { status: response.status }
      );
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error("Market Morning Summary API Error:", error);
    return NextResponse.json(
      { success: false, data: { indices: [], exchangeRates: [], collectedDate: null } },
      { status: 500 }
    );
  }
}
