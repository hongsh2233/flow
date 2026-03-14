import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

/**
 * 메인 노출 게시글 (show_on_main=true) - 해외지수 위 카드뉴스용
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "10";

    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiSecretKey) headers["X-API-KEY"] = apiSecretKey;

    const response = await fetch(
      `${API_BASE_URL}/api/main-posts?limit=${limit}`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, data: [] },
        { status: response.status }
      );
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error("[main-posts] 오류:", error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
