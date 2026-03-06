import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "로그인 후 이용 가능합니다." },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {};
    if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

    const url = new URL(`${API_BASE_URL}/api/auth/member/jubti`);
    url.searchParams.set("email", session.user.email);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.detail ?? "주BTI 조회에 실패했습니다." },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("주BTI 조회 API 프록시 오류:", error);
    return NextResponse.json(
      { success: false, message: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
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
