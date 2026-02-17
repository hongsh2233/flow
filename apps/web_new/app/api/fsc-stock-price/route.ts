import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * FSC 주식시세 - BO 백엔드 경유 (관심종목 시세 매핑용)
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
      `${API_BASE_URL}/api/fsc-stock-price?${params.toString()}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        console.warn("FSC Stock Price API: BO unavailable, fallback:", errorText.slice(0, 100));
        return NextResponse.json({
          success: true,
          data: [],
          bas_dt: null,
          count: 0,
          message: "FSC 주식시세를 불러올 수 없습니다.",
        });
      }
      return NextResponse.json(
        { success: false, message: "FSC 주식시세 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn("FSC 주식시세 조회 실패:", error);
    return NextResponse.json({
      success: true,
      data: [],
      bas_dt: null,
      count: 0,
      message: "FSC 주식시세를 불러올 수 없습니다.",
    });
  }
}
