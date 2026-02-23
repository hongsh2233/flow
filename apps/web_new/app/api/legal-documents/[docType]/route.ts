import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

/**
 * 법적 문서 조회 (개인정보처리방침, 이용약관)
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
        { success: false, content: "" },
        { status: 400 }
      );
    }

    const url = `${API_BASE_URL}/api/legal-documents/${docType}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, content: "" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Legal document API 프록시 오류:", error);
    return NextResponse.json(
      { success: false, content: "" },
      { status: 500 }
    );
  }
}
