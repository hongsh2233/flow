/**
 * 인증 및 회원 관련 서비스
 * 관심종목 조회 - /api/auth/favorites 경유
 */

import type { ApiResponse } from "@/lib/types/board";
import type { FavoriteStockResponse } from "@/lib/types/api";

/**
 * 관심종목 조회 (세션 기반, 클라이언트에서 fetch)
 */
export async function getFavoriteStocks(
  _email?: string
): Promise<ApiResponse<FavoriteStockResponse>> {
  try {
    const response = await fetch("/api/auth/favorites", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        message: "관심종목을 불러올 수 없습니다.",
        error: errorText,
      };
    }

    const data: FavoriteStockResponse = await response.json();
    return {
      success: data.success,
      message: data.message,
      data,
    };
  } catch (error) {
    console.error("관심종목 조회 오류:", error);
    return {
      success: false,
      message: "관심종목을 불러올 수 없습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 회원 탈퇴
 * @param email - 회원 이메일
 * @returns 탈퇴 결과
 */
export async function withdrawMember(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const response = await fetch(
      `/api/auth/member/withdraw?email=${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        message: "회원 탈퇴를 처리할 수 없습니다.",
        error: errorText,
      };
    }

    const data = await response.json();
    return {
      success: data.success ?? true,
      message: data.message ?? "회원 탈퇴가 완료되었습니다.",
    };
  } catch (error) {
    console.error("회원 탈퇴 오류:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "회원 탈퇴 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
