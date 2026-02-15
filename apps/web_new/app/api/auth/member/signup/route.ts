import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(`${API_BASE_URL}/api/auth/member/signup`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || "회원가입에 실패했습니다." },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("회원가입 API 프록시 오류:", error);
    return NextResponse.json(
      { detail: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
