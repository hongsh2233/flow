import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY, getImageUrl } from "@/lib/config/api";

/**
 * 배너관리(managed) 배너 조회 - BO /api/banners/managed 경유
 * page_path: 노출할 페이지 경로 (예: /, /stocks, /news)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagePath = searchParams.get("page_path") || "/";
    const position = searchParams.get("position");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    let url = `${API_BASE_URL}/api/banners/managed?page_path=${encodeURIComponent(pagePath)}`;
    if (position) url += `&position=${encodeURIComponent(position)}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "배너 조회 실패", data: null },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      return NextResponse.json({
        success: true,
        data: { singles: [], slides: [] },
        count: 0,
      });
    }

    // image_url을 절대 URL로 변환
    type BannerItem = { image_url?: string | null; [key: string]: unknown };
    const mapItem = (item: BannerItem) => ({
      ...item,
      image_url: item.image_url ? getImageUrl(item.image_url as string) : null,
    });

    const singles = (data.data.singles ?? []).map((i: unknown) => mapItem(i as BannerItem));
    const slides = (data.data.slides ?? []).map((s: { items?: unknown[]; [key: string]: unknown }) => ({
      ...s,
      items: (s.items ?? []).map((i: unknown) => mapItem(i as BannerItem)),
    }));

    return NextResponse.json({
      success: true,
      data: { singles, slides },
      count: data.count ?? 0,
    });
  } catch (error) {
    console.error("managed 배너 조회 오류:", error);
    return NextResponse.json(
      { success: false, message: "배너를 불러올 수 없습니다.", data: null },
      { status: 500 }
    );
  }
}
