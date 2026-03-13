import { NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 금일 이슈 Gemini 요약 조회 (briefing 이슈 탭 상단용)
 */
export async function GET() {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/daily-issue-summary`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("금일 이슈 요약 조회 오류:", error);
    return NextResponse.json(
      { success: false, summary: null },
      { status: 500 }
    );
  }
}
