import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** 로그인한 회원의 저장된 주BTI 성향 조회 (이미 테스트 완료 여부 판단용) */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: true, jubti_type: null });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;
    const res = await fetch(
      `${API_BASE_URL}/api/auth/member/info?email=${encodeURIComponent(session.user.email)}`,
      { headers, cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    const jubti_type = data?.jubti_type && ["A", "D", "N", "I"].includes(data.jubti_type) ? data.jubti_type : null;
    return NextResponse.json({ success: true, jubti_type });
  } catch {
    return NextResponse.json({ success: true, jubti_type: null });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "로그인 후 이용 가능합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const jubti_type = body?.jubti_type as string;
    if (!jubti_type || !["A", "D", "N", "I"].includes(jubti_type)) {
      return NextResponse.json(
        { success: false, message: "유효한 성향 값이 아닙니다." },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const response = await fetch(`${API_BASE_URL}/api/auth/member/jubti`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        email: session.user.email,
        jubti_type,
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.detail ?? "주BTI 저장에 실패했습니다.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("주BTI 저장 API 프록시 오류:", error);
    return NextResponse.json(
      {
        success: false,
        message: "저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
