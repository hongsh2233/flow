import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 대가 명언 좋아요 토글 - Admin API 프록시 (CORS 문제 방지)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const body = await request.json().catch(() => ({}));
    const { email, guest_id: guestId } = body as { email?: string; guest_id?: string };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const url = `${API_BASE_URL}/api/master-quotes/${quoteId}/like`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: email || undefined, guest_id: guestId }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("대가 명언 좋아요 오류:", error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
