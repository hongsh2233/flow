import { NextRequest, NextResponse } from "next/server";

const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || "";

const BASE_URL =
  "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2";

/**
 * 기업개요조회 - 금융위원회_기업기본정보 getCorpOutline_V2
 *
 * data.go.kr serviceKey 주의사항:
 *   포털에서 제공되는 인코딩(encoded) 키를 그대로 사용할 경우
 *   URLSearchParams 를 거치면 이중 인코딩이 발생하여 API가 거부합니다.
 *   따라서 serviceKey 는 URL 문자열에 직접 이어붙이고,
 *   나머지 파라미터만 URLSearchParams 로 인코딩합니다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const corpNm = searchParams.get("corpNm")?.trim() ?? "";

  if (!corpNm) {
    return NextResponse.json(
      { success: false, message: "corpNm 파라미터가 필요합니다.", data: [] },
      { status: 400 }
    );
  }

  if (!DATA_GO_KR_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        message: "DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.",
        data: [],
      },
      { status: 500 }
    );
  }

  try {
    // serviceKey 는 직접 붙여 이중 인코딩 방지
    const otherParams = new URLSearchParams({
      corpNm,
      pageNo: "1",
      numOfRows: "10",
      resultType: "json",
    });
    const url = `${BASE_URL}?serviceKey=${DATA_GO_KR_API_KEY}&${otherParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const text = await response.text();

    // XML 오류 응답 처리 (resultType=json 임에도 XML 로 오는 경우 있음)
    if (text.trimStart().startsWith("<")) {
      console.error("Corp outline API returned XML:", text.slice(0, 300));
      const codeMatch = text.match(/<errMsg>(.*?)<\/errMsg>/);
      const msg = codeMatch?.[1] ?? "기업정보 조회에 실패했습니다. (XML 오류)";
      return NextResponse.json({ success: false, message: msg, data: [] }, { status: 502 });
    }

    const json = JSON.parse(text);

    // 정상 응답 코드 확인
    const resultCode = json?.response?.header?.resultCode;
    if (resultCode && resultCode !== "00" && resultCode !== "000") {
      const resultMsg = json?.response?.header?.resultMsg ?? "알 수 없는 오류";
      console.error(`Corp outline API resultCode ${resultCode}: ${resultMsg}`);
      return NextResponse.json(
        { success: false, message: `API 오류 (${resultCode}): ${resultMsg}`, data: [] },
        { status: 502 }
      );
    }

    const raw = json?.response?.body?.items?.item;
    const list: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : [];

    return NextResponse.json({ success: true, data: list, total: list.length });
  } catch (error) {
    console.error("Corp outline API error:", error);
    return NextResponse.json(
      { success: false, message: "기업정보 조회 중 오류가 발생했습니다.", data: [] },
      { status: 500 }
    );
  }
}
