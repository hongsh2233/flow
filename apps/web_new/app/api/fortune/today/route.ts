import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fortune_type = searchParams.get("fortune_type");
    const key = searchParams.get("key");
    if (!fortune_type || !key) {
      return NextResponse.json({ success: false, message: "fortune_type과 key가 필요합니다." }, { status: 400 });
    }
    const headers: Record<string, string> = {};
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const url = new URL(`${API_BASE_URL}/api/fortune/today`);
    url.searchParams.set("fortune_type", fortune_type);
    url.searchParams.set("key", key);
    const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.detail ?? "운세 조회 실패" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("운세 조회 오류:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
