import { NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!API_BASE_URL) {
      return NextResponse.json({ brokers: [] });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const res = await fetch(`${API_BASE_URL}/api/brokers`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ brokers: [] });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ brokers: [] });
  }
}
