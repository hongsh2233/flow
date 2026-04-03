import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(`${API_BASE_URL}/api/auth/member/request-password-reset`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: data.detail || data.message || "요청에 실패했습니다." },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("비밀번호 재설정 요청 오류:", error);
    return NextResponse.json(
      { success: false, message: "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
