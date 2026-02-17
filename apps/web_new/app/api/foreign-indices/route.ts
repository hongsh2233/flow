import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

interface ForeignIndexItem {
  symbol: string;
  name: string;
  market?: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  error?: string;
}

interface ForeignIndicesResponse {
  success: boolean;
  data: ForeignIndexItem[];
  count?: number;
}

/**
 * 해외지수 - BO 백엔드 경유 조회 (Yahoo Finance 프록시)
 */
export async function GET(_request: NextRequest) {
  try {
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiSecretKey) {
      headers["X-API-KEY"] = apiSecretKey;
    } else {
      console.warn("[해외지수 API] NEXT_PUBLIC_X_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch(`${API_BASE_URL}/api/foreign-indices`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("BO foreign-indices 응답 오류:", response.status, response.statusText);
      return NextResponse.json(
        { success: false, message: "해외지수 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const json: ForeignIndicesResponse = await response.json();

    if (!json.success || !Array.isArray(json.data)) {
      return NextResponse.json(
        { success: false, message: "해외지수 조회 실패", data: [] },
        { status: 500 }
      );
    }

    const validResults = json.data
      .filter(
        (
          item
        ): item is ForeignIndexItem & {
          price: number;
          change: number;
          change_percent: number;
        } =>
          item != null &&
          !("error" in item && item.error) &&
          typeof item.price === "number" &&
          !Number.isNaN(item.price) &&
          typeof item.change === "number" &&
          typeof item.change_percent === "number"
      )
      .map((item) => ({
        name: item.name,
        symbol: item.symbol,
        value: item.price.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        change: item.change >= 0 ? `+${item.change.toFixed(2)}` : item.change.toFixed(2),
        percent:
          item.change_percent >= 0
            ? `+${item.change_percent.toFixed(2)}%`
            : `${item.change_percent.toFixed(2)}%`,
      }));

    return NextResponse.json({
      success: true,
      message: "지수를 성공적으로 가져왔습니다.",
      data: validResults,
    });
  } catch (error) {
    console.error("Foreign Indices API Error (BO proxy):", error);
    return NextResponse.json(
      { success: false, message: "지수를 가져오는 중 오류가 발생했습니다.", data: [] },
      { status: 500 }
    );
  }
}
