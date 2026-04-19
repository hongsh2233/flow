import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const VALID_MBTI = new Set([
  "INTJ","INTP","ENTJ","ENTP","ISTJ","ISFJ","ESTJ","ESFJ",
  "ISTP","ESTP","ENFJ","ENFP","INFJ","INFP","ESFP","ISFP",
]);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "로그인 후 이용 가능합니다." }, { status: 401 });
    }
    const headers: Record<string, string> = {};
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const url = new URL(`${API_BASE_URL}/api/auth/member/mbti`);
    url.searchParams.set("email", session.user.email);
    const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.detail ?? "MBTI 조회 실패" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("MBTI 조회 오류:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "로그인 후 이용 가능합니다." }, { status: 401 });
    }
    const body = await request.json();
    const mbti_type = (body?.mbti_type as string)?.toUpperCase();
    if (!mbti_type || !VALID_MBTI.has(mbti_type)) {
      return NextResponse.json({ success: false, message: "유효한 MBTI 유형이 아닙니다." }, { status: 400 });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const response = await fetch(`${API_BASE_URL}/api/auth/member/mbti`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ email: session.user.email, mbti_type }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.detail ?? "MBTI 저장 실패" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("MBTI 저장 오류:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
