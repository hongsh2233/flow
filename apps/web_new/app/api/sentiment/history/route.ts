import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

export async function GET(request: NextRequest) {
  try {
    const days = request.nextUrl.searchParams.get("days") ?? "7";
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiSecretKey) headers["X-API-KEY"] = apiSecretKey;

    const res = await fetch(`${API_BASE_URL}/api/sentiment/history?days=${days}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, data: [] }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    console.error("[sentiment/history]", e);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
