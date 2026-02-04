/**
 * 권리행사일정 서비스
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

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
      `/api/right-schedule?${params}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
