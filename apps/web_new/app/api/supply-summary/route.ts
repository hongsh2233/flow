import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 홈페이지 수급 요약 카드용 API (BO 백엔드 경유)
 * query: market=kospi|kosdaq
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market") ?? "kospi";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/supply-summary?market=${encodeURIComponent(market)}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "수급 요약 조회 실패" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.warn("supply-summary API 오류:", error);
    return NextResponse.json({ success: false, message: "수급 요약 조회 실패" });
  }
}
