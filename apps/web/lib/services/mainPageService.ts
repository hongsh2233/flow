/**
 * 메인 페이지 설정 서비스
 */

import type { ApiResponse, MainPageConfigResponse } from '@/lib/types/api'

/**
 * 메인 페이지 설정 조회
 * Next.js API route를 통해 admin 서버로 프록시
 * @returns 메인 페이지 설정 응답
 */
export async function getMainPageConfig(): Promise<ApiResponse<MainPageConfigResponse>> {
  try {
    // Next.js API route를 통해 호출 (CORS 문제 방지)
    const response = await fetch('/api/main-page-config', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      // 404 = 백엔드 미가동 또는 설정 없음 → 빈 설정으로 처리해 메인 페이지 정상 로드
      if (response.status === 404) {
        return {
          success: true,
          message: '메인 페이지 설정이 없습니다.',
          data: {
            success: true,
            message: '메인 페이지 설정이 없습니다.',
            items: [],
          },
        }
      }
      console.error(`Main page config API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '메인 페이지 설정을 불러올 수 없습니다.',
        error: errorText,
        data: {
          success: false,
          message: '메인 페이지 설정을 불러올 수 없습니다.',
          items: [],
        },
      }
    }

    const data: MainPageConfigResponse = await response.json()
    
    // API route가 실패한 경우 처리
    if (data.success === false) {
      return {
        success: false,
        message: data.message || '메인 페이지 설정을 불러올 수 없습니다.',
        error: data.message,
        data: {
          success: false,
          message: data.message || '메인 페이지 설정을 불러올 수 없습니다.',
          items: [],
        },
      }
    }

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
      data: {
        success: false,
        message: error instanceof Error ? error.message : '메인 페이지 설정 조회 중 오류가 발생했습니다.',
        items: [],
      },
    }
  }
}

