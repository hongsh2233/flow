import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 기업개요조회 - BO(FastAPI) /api/corp-outline 경유
 *
 * corpNm(법인명)으로 기업기본정보를 조회한다.
 * BO 쪽에서 data.go.kr 금융위원회_기업기본정보 getCorpOutline_V2 를 호출한다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const corpNm = searchParams.get("corpNm")?.trim() ?? "";

    if (!corpNm) {
      return NextResponse.json(
        { success: false, message: "corpNm 파라미터가 필요합니다.", data: [] },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      params.append(key, value);
    });

    // 기본 조회 범위 지정 (없으면 BO 기본값 사용)
    if (!params.has("page_no")) {
      params.set("page_no", "1");
    }
    if (!params.has("num_of_rows")) {
      params.set("num_of_rows", "50");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/corp-outline?${params.toString()}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: err.error || "기업기본정보 조회에 실패했습니다.",
          data: [],
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    // BO 응답 그대로 전달 (Search 페이지는 data 배열만 사용)
    return NextResponse.json({
      success: true,
      data: Array.isArray(data.data) ? data.data : [],
      total: data.total_count ?? data.count ?? 0,
    });
  } catch (error) {
    console.error("Corp outline proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "기업정보 조회 중 오류가 발생했습니다.",
        data: [],
      },
      { status: 500 }
    );
  }
}
