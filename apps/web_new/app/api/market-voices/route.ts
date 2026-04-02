import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/** 시장의 목소리 (BO 승인분) */
interface VoiceItem {
  id: number;
  name: string;
  title: string;
  image: string;
  sourceCode?: string;
  statement: string;
  source_url?: string;
  source_title?: string;
  time: string;
}

/**
 * 시장의 목소리 — BO approved 만 (투자은행 뉴스 병합은 비활성화)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "30";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const mvRes = await fetch(`${API_BASE_URL}/api/market-voices?limit=${limit}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const mvData = mvRes.ok ? await mvRes.json() : { data: [] };
    const mvItems = (mvData?.data ?? []) as VoiceItem[];

    return NextResponse.json({ success: true, data: mvItems });
  } catch (error) {
    console.error("시장의 목소리 조회 오류:", error);
    return NextResponse.json(
      { success: false, data: [] },
      { status: 500 }
    );
  }
}
