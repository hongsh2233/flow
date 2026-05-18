import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

export async function GET(_request: NextRequest) {
  try {
    const apiSecretKey = process.env.X_API_KEY || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiSecretKey) headers["X-API-KEY"] = apiSecretKey;

    const res = await fetch(`${API_BASE_URL}/api/sentiment/latest`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, data: null }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    console.error("[sentiment/latest]", e);
    return NextResponse.json({ success: false, data: null }, { status: 500 });
  }
}
