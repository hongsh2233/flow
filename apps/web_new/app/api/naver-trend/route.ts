import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 네이버 검색어 트렌드 프록시
 * category: 투자환경 | 테마섹터 (기본: 테마섹터)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "테마섹터";
    const timeUnit = searchParams.get("time_unit") || "date";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const url = `${API_BASE_URL}/api/naver-trend/data?category=${encodeURIComponent(category)}&time_unit=${encodeURIComponent(timeUnit)}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "트렌드 데이터 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("트렌드 데이터 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "트렌드 데이터 조회 중 오류 발생",
        data: [],
      },
      { status: 500 }
    );
  }
}
