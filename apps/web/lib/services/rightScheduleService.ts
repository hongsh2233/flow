/**
 * 권리행사일정 서비스
 * Stock BO API 연동 - DB/백엔드 미준비 시 빈 데이터 반환
 */

import { API_BASE_URL, getAuthHeaders } from '@/lib/config/api'
import type { RightScheduleItem } from '@/lib/types/api'

export interface FetchRightScheduleResult {
  error?: string
  data?: RightScheduleItem[]
  count?: number
  latest_bas_dt?: string
}

/**
 * 권리행사일정 조회 (주식발행회사명 또는 법인등록번호)
 */
export async function fetchRightSchedule(
  query: string
): Promise<FetchRightScheduleResult> {
  try {
    const params = new URLSearchParams({ q: query.trim() })
    const response = await fetch(
      `${API_BASE_URL}/api/right-schedule?${params}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        error: '권리행사일정을 불러올 수 없습니다.',
        data: [],
      }
    }

    const data = await response.json()
    if (data.error) {
      return { error: data.error, data: [] }
    }
    return {
      data: data.data ?? data.items ?? [],
      count: data.count ?? data.data?.length ?? 0,
      latest_bas_dt: data.latest_bas_dt ?? data.latestBasDt,
    }
  } catch (error) {
    console.error('권리행사일정 조회 오류:', error)
    return {
      error: error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.',
      data: [],
    }
  }
}
