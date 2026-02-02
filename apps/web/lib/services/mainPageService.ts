/**
 * 메인 페이지 설정 서비스
 */

import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'
import type { ApiResponse, MainPageConfigResponse } from '@/lib/types/api'

/**
 * 메인 페이지 설정 조회
 * @returns 메인 페이지 설정 응답
 */
export async function getMainPageConfig(): Promise<ApiResponse<MainPageConfigResponse>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(`${API_BASE_URL}/api/main-page-config`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Main page config API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '메인 페이지 설정을 불러올 수 없습니다.',
        error: errorText,
      }
    }

    const data: MainPageConfigResponse = await response.json()
    return {
      success: data.success,
      message: data.message,
      data: data,
    }
  } catch (error) {
    console.error('메인 페이지 설정 조회 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '메인 페이지 설정 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

