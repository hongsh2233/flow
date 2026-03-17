import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

/**
 * 이미지 업로드 프록시 (TOAST UI Editor addImageBlobHook용)
 * 백엔드 /api/upload-image에 multipart/form-data로 전달
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "로그인 후 이용해 주세요." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, message: "파일이 없습니다." },
        { status: 400 }
      );
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const headers: Record<string, string> = {};
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
      method: "POST",
      headers,
      body: uploadForm,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "업로드 실패");
      return NextResponse.json(
        { success: false, message: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[upload-image] 오류:", error);
    return NextResponse.json(
      { success: false, message: "이미지 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
