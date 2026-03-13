import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

const API_KEY = process.env.NEXT_PUBLIC_X_API_KEY || "";

/**
 * 법적 문서 조회 (개인정보처리방침, 이용약관, 앱 소개)
 * BO /api/legal-documents/{docType} 프록시
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  try {
    const { docType } = await params;
    if (docType !== "privacy" && docType !== "terms" && docType !== "about") {
      return NextResponse.json(
        { success: false, content: null },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_KEY) headers["X-API-KEY"] = API_KEY;

    const baseUrl = API_BASE_URL.replace(/\/+$/, "");
    const url = `${baseUrl}/api/legal-documents/${docType}`;
    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      console.error(`Legal document API(${docType}) 실패: ${res.status}`);
      return NextResponse.json(
        { success: false, content: null },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      content: data.content ?? null,
      api_base_url: baseUrl,
    });
  } catch (error) {
    console.error("Legal document API 프록시 오류:", error);
    return NextResponse.json(
      { success: false, content: null },
      { status: 502 }
    );
  }
}
