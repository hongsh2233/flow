import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

const FALLBACK_API_KEY = "1978022019820308200705092018111420220303";

/**
 * 네이버 수급 동향 일자별 데이터 - BO 백엔드 경유
 * data_type: investor_day (기본값)
 * market: kospi | kosdaq | futures | all
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => params.append(key, value));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-KEY": API_SECRET_KEY || FALLBACK_API_KEY,
    };

    const response = await fetch(
      `${API_BASE_URL}/api/naver-supply-data?${params.toString()}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, data: null, message: "수급 데이터 조회 실패" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.warn("수급 데이터 조회 실패:", error);
    return NextResponse.json({ success: false, data: null });
  }
}
