import { NextRequest, NextResponse } from "next/server";
import { getBatchStockQuotes } from "@/lib/server/stockQuotes";

export const dynamic = "force-dynamic";

/**
 * GET ?codes=005930,035720
 * 네이버 지연 시세(우선) + 서버 캐시, 실패 시 BO FSC 종가 폴백
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codesParam = searchParams.get("codes")?.trim() ?? "";
  const codes = codesParam
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (codes.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "codes 파라미터가 필요합니다.",
        quotes: {},
        cacheTtlSeconds: 0,
        servedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  try {
    const { quotes, cacheTtlSeconds, servedAt } = await getBatchStockQuotes(codes);
    return NextResponse.json({
      success: true,
      quotes,
      cacheTtlSeconds,
      servedAt,
    });
  } catch (e) {
    console.warn("[stock-quotes-batch]", e);
    return NextResponse.json(
      {
        success: false,
        message: "시세 조회 중 오류가 발생했습니다.",
        quotes: {},
        cacheTtlSeconds: 0,
        servedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
