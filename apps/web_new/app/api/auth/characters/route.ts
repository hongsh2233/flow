import { NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function GET() {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(`${API_BASE_URL}/api/auth/characters`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("캐릭터 목록 API 프록시 오류:", error);
    return NextResponse.json(
      { success: false, message: "캐릭터 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
