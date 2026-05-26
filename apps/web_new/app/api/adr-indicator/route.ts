import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const url = new URL("/api/adr-indicator", API_BASE_URL);
    if (date) {
      url.searchParams.set("date", date);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Backend error: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("ADR Indicator API Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch ADR indicator",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
