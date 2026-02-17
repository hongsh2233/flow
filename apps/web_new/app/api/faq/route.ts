import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api";

/**
 * FAQ 목록 조회 - 설정 > 지원 > 자주하는 질문
 * BO /api/faq 프록시
 */
export async function GET() {
  try {
    const url = `${API_BASE_URL}/api/faq`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, data: [] },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("FAQ API 프록시 오류:", error);
    return NextResponse.json(
      { success: false, data: [] },
      { status: 500 }
    );
  }
}
