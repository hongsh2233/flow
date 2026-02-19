import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 환율 - Admin DB 저장 데이터 조회 (30분마다 수집)
 */
export async function GET(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/exchange-rate`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "환율 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const json = await response.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return NextResponse.json({
        success: true,
        data: json.data.map((r: { currency: string; rate: string; change: string; isPositive: boolean }) => ({
          currency: r.currency,
          rate: r.rate,
          change: r.change,
          isPositive: r.isPositive,
        })),
        base_timestamp: json.base_timestamp ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      data: [],
      base_timestamp: null,
    });
  } catch (error) {
    console.error("Exchange Rate API Error:", error);
    return NextResponse.json(
      { success: false, message: "환율 정보를 가져오는데 실패했습니다.", data: [] },
      { status: 500 }
    );
  }
}
