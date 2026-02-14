import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/member/update`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        {
          success: false,
          message: "회원 정보를 업데이트할 수 없습니다.",
          error: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("회원 정보 업데이트 프록시 오류:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "회원 정보 업데이트 중 오류 발생",
      },
      { status: 500 }
    );
  }
}
