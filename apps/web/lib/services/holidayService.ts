/**
 * 공휴일 서비스
 * Stock BO API 연동 - DB/백엔드 미준비 시 빈 데이터 반환
 */

import { API_BASE_URL, getAuthHeaders } from '@/lib/config/api'
import type { ApiResponse, Holiday } from '@/lib/types/api'

/**
 * 공휴일 목록 조회
 * @param year 연도 (예: 2025)
 */
export async function fetchHolidays(
  year: number
): Promise<ApiResponse<Holiday[]>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/holidays?year=${year}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        success: false,
        message: '공휴일 데이터를 불러올 수 없습니다.',
        error: errorText,
        data: [],
      }
    }

    const data = await response.json()
    const items = data.data ?? data.holidays ?? (Array.isArray(data) ? data : [])
    return { success: true, data: items }
  } catch (error) {
    console.error('공휴일 조회 오류:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : '공휴일 데이터를 불러오는데 실패했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    }
  }
}
