import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

/**
 * 국내지수(코스피/코스닥) - BO 백엔드 경유 조회
 * Yahoo Finance 직접 호출 시 오류 방지
 */
export async function GET(_request: NextRequest) {
  try {
    const apiSecretKey = process.env.X_API_KEY || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiSecretKey) {
      headers["X-API-KEY"] = apiSecretKey;
    } else {
      console.warn("[국내지수 API] X_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch(`${API_BASE_URL}/api/domestic-indices`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("BO domestic-indices 응답 오류:", response.status, response.statusText);
      return NextResponse.json(
        { success: false, message: "국내 지수 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const json = await response.json();

    if (!json.success) {
      return NextResponse.json(
        { success: false, message: json.message || "국내 지수 조회 실패", data: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: json.success,
      data: json.data ?? [],
      timestamp: json.timestamp ?? "",
    });
  } catch (error) {
    console.error("Domestic Indices API Error (BO proxy):", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch indices", data: [] },
      { status: 500 }
    );
  }
}
