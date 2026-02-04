/**
 * 일정 서비스
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

import type { ApiResponse, Schedule } from '@/lib/types/api'

export interface FetchSchedulesParams {
  start_date?: string
  end_date?: string
  type?: string
  [key: string]: string | undefined
}

/**
 * 일정 목록 조회
 */
export async function fetchSchedules(
  params: FetchSchedulesParams = {}
): Promise<ApiResponse<Schedule[]>> {
  try {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })

    const queryString = searchParams.toString()
    const url = queryString
      ? `/api/schedules?${queryString}`
      : '/api/schedules'

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        success: false,
        message: '일정을 불러올 수 없습니다.',
        error: errorText,
        data: [],
      }
    }

    const data = await response.json()
    const items = data.data ?? data.schedules ?? (Array.isArray(data) ? data : [])
    return { success: true, data: items }
  } catch (error) {
    console.error('일정 조회 오류:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : '일정을 불러오는데 실패했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    }
  }
}
