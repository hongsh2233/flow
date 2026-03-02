import { NextRequest, NextResponse } from "next/server";

const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || "";

/**
 * 기업개요조회 - 공공데이터포털 GetCorpBasicInfoService_V2/getCorpOutline_V2
 * corpNm: 법인명(검색회사명)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const corpNm = searchParams.get("corpNm") || "";

  if (!corpNm) {
    return NextResponse.json(
      { success: false, message: "corpNm 파라미터가 필요합니다.", data: [] },
      { status: 400 }
    );
  }

  if (!DATA_GO_KR_API_KEY) {
    return NextResponse.json(
      { success: false, message: "공공데이터포털 API 키가 설정되지 않았습니다.", data: [] },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2"
    );
    url.searchParams.append("serviceKey", DATA_GO_KR_API_KEY);
    url.searchParams.append("corpNm", corpNm);
    url.searchParams.append("pageNo", "1");
    url.searchParams.append("numOfRows", "5");
    url.searchParams.append("resultType", "json");

    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "기업정보 조회에 실패했습니다.", data: [] },
        { status: response.status }
      );
    }

    const json = await response.json();
    const raw = json?.response?.body?.items?.item;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("Corp outline API error:", error);
    return NextResponse.json(
      { success: false, message: "기업정보 조회 중 오류가 발생했습니다.", data: [] },
      { status: 500 }
    );
  }
}
