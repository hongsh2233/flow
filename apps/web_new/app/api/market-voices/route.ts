import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/** 시장의 목소리 + 투자은행 뉴스(GS/MS/JPM) 통합 응답 항목 */
interface VoiceItem {
  id: number;
  name: string;
  title: string;
  image: string;
  statement: string;
  source_url?: string;
  source_title?: string;
  time: string;
}

const SOURCE_NAMES: Record<string, string> = {
  GS: "골드만삭스",
  MS: "모건스탠리",
  JPM: "JP모건",
};

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop";

/**
 * 시장의 목소리 - BO approved + 투자은행 뉴스(GS/MS/JPM) 통합 조회 (stock-chat 노출용)
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

    const [mvSettled, ibnSettled] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/market-voices?limit=${limit}`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${API_BASE_URL}/api/investment-bank-news?limit=10`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
    ]);

    const mvData =
      mvSettled.status === "fulfilled" && mvSettled.value.ok
        ? await mvSettled.value.json()
        : { data: [] };
    const ibnData =
      ibnSettled.status === "fulfilled" && ibnSettled.value.ok
        ? await ibnSettled.value.json()
        : { data: [] };

    const mvItems = (mvData?.data ?? []) as VoiceItem[];
    const ibnItems = (ibnData?.data ?? []) as Array<{
      id: number;
      source: string;
      title: string;
      summary?: string;
      source_url?: string;
      time?: string;
    }>;

    const ibnMapped: VoiceItem[] = ibnItems.map((r) => ({
      id: 100000 + r.id,
      name: SOURCE_NAMES[r.source] || r.source,
      title: "주요 투자사",
      image: DEFAULT_AVATAR,
      statement: r.title,
      source_url: r.source_url,
      source_title: r.title,
      time: r.time || "",
    }));

    const merged = [...mvItems, ...ibnMapped];
    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    console.error("시장의 목소리 조회 오류:", error);
    return NextResponse.json(
      { success: false, data: [] },
      { status: 500 }
    );
  }
}
