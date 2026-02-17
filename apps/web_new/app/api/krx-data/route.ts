import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * KRX 데이터 - BO finance-data (한국거래소) 연동
 * data_type: kospi | kosdaq | market
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
      `${API_BASE_URL}/api/krx-data?${params.toString()}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
        });
      }
      return NextResponse.json(
        { success: false, message: "KRX 데이터 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn("KRX 데이터 조회 실패:", error);
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
    });
  }
}
