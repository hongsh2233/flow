import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(`${API_BASE_URL}/api/auth/member/verify-email`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("이메일 확인 오류:", error);
    return NextResponse.json(
      { success: false, message: "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
