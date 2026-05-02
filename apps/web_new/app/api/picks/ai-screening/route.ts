import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { sessionToPicksTier } from "@/lib/picks/gradeTier";
import { applyScreeningMask, type ScreeningRow } from "@/lib/picks/screeningMask";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const marketType = searchParams.get("market_type") ?? "kospi";
    const screeningType = searchParams.get("screening_type") ?? "ichimoku";
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50)
    );

    if (!API_BASE_URL || !API_SECRET_KEY) {
      return NextResponse.json({
        success: true,
        data: [],
        screening_date: null,
        count: 0,
        tier: sessionToPicksTier(null),
        message: "API 설정이 없습니다.",
      });
    }

    const session = await getServerSession(authOptions);
    const tier = sessionToPicksTier(session);

    const path =
      screeningType === "jongbe"
        ? "/api/jongbe-screening"
        : screeningType === "ricebowl"
          ? "/api/ricebowl-screening"
          : screeningType === "breakout"
            ? "/api/breakout-screening"
            : screeningType === "leader"
              ? "/api/leader-screening"
              : "/api/stock-screening";
    const params = new URLSearchParams({
      market_type: marketType.toLowerCase(),
      limit: String(limit),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-KEY": API_SECRET_KEY,
    };

    const res = await fetch(`${API_BASE_URL}${path}?${params}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[picks/ai-screening] BO error", res.status, text.slice(0, 200));
      return NextResponse.json(
        {
          success: false,
          data: [],
          screening_date: null,
          count: 0,
          tier,
          message: "스크리닝 데이터를 불러오지 못했습니다.",
        },
        { status: res.status === 401 ? 401 : 502 }
      );
    }

    const raw = (await res.json()) as {
      success?: boolean;
      data?: ScreeningRow[];
      screening_date?: string | null;
      count?: number;
    };

    const rows = Array.isArray(raw.data) ? raw.data : [];
    const masked = applyScreeningMask(rows, tier);

    return NextResponse.json({
      success: raw.success !== false,
      data: masked,
      screening_date: raw.screening_date ?? null,
      count: masked.length,
      tier,
    });
  } catch (e) {
    console.warn("[picks/ai-screening]", e);
    return NextResponse.json(
      {
        success: false,
        data: [],
        screening_date: null,
        count: 0,
        tier: "guest" as const,
        message: "오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
