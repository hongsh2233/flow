import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 네이버 증권 랭킹 - BO 백엔드 경유
 * ranking_type: volume | amount | search
 * market_type: kospi | kosdaq | all
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rankingType = searchParams.get("ranking_type") || "volume";
    const marketType = searchParams.get("market_type") || "all";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const url = `${API_BASE_URL}/api/naver-stock-ranking?ranking_type=${rankingType}&market_type=${marketType}&limit=${limit}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "랭킹 데이터 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    const collectedAt = data.collected_at as string | undefined;
    const collectedTime = data.collected_time as string | undefined;
    let base_timestamp: string | null = null;
    if (collectedAt && collectedTime) {
      base_timestamp = `${collectedAt.slice(0, 10)} ${collectedTime}`;
    } else if (collectedAt) {
      base_timestamp = collectedAt.slice(0, 16).replace("T", " ");
    }
    return NextResponse.json({ ...data, base_timestamp });
  } catch (error) {
    console.error("랭킹 데이터 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "랭킹 데이터 조회 중 오류 발생",
        data: [],
      },
      { status: 500 }
    );
  }
}
