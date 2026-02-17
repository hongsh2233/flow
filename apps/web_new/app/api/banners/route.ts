import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY, getImageUrl } from "@/lib/config/api";

/**
 * 배너 목록 - BO 백엔드 경유
 * banner_type: top_banner | banner
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bannerType = searchParams.get("banner_type") || "banner";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/banners?banner_type=${bannerType}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "배너 조회 실패", data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.data)) {
      return NextResponse.json({ success: true, data: [] });
    }

    const items = data.data.map((b: { image_url?: string; link_url?: string; alt_text?: string }) => ({
      title: b.alt_text || "배너",
      imageUrl: b.image_url ? getImageUrl(b.image_url) : undefined,
      href: b.link_url || undefined,
      closeable: false,
    }));

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("배너 조회 오류:", error);
    return NextResponse.json(
      { success: false, message: "배너를 불러올 수 없습니다.", data: [] },
      { status: 500 }
    );
  }
}
