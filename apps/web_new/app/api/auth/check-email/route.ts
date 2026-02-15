import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    if (!email) {
      return NextResponse.json(
        { success: false, message: "이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(
      `${API_BASE_URL}/api/auth/check-email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers, cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("이메일 확인 API 프록시 오류:", error);
    return NextResponse.json(
      { success: false, message: "이메일 확인에 실패했습니다." },
      { status: 500 }
    );
  }
}
