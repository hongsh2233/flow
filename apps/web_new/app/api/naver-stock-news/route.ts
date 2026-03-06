import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 네이버 주가 영향 뉴스 - BO DB 연동
 * category: 수주/실적발표/배당/연구개발/기술이전/유상증자/무상증자/자사주매입/합병인수/특허/임상/적자전환/상장/분할
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
      `${API_BASE_URL}/api/naver-stock-news?${params.toString()}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ success: true, data: [], total: 0, count: 0 });
      }
      return NextResponse.json(
        { success: false, message: "주목 뉴스 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn("주목 뉴스 조회 실패:", error);
    return NextResponse.json({ success: true, data: [], total: 0, count: 0 });
  }
}
