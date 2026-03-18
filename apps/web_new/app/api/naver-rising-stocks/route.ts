import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 네이버증권 상승종목 (10%이상) - BO 백엔드 경유
 * market_type: kospi | kosdaq
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => params.append(key, value));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/naver-rising-stocks?${params.toString()}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        return NextResponse.json({
          success: true,
          data: [],
          collected_time: null,
          count: 0,
        });
      }
      return NextResponse.json(
        { success: false, data: [], message: "상승종목 조회 실패" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.warn("네이버 상승종목 조회 실패:", error);
    return NextResponse.json({
      success: true,
      data: [],
      collected_time: null,
      count: 0,
    });
  }
}
