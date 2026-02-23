/**
 * 일정 서비스 - BO API 프록시 연동
 */

export interface ScheduleFromApi {
  id: number
  date: string
  end_date?: string | null
  scheduled_time?: string
  subject: string
  content: string
  detail: string
  type: string
  created_at?: string
  updated_at?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  count?: number
}

/**
 * 일정 목록 조회
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD
 * @param type manual | api
 */
export async function fetchSchedules(
  startDate?: string,
  endDate?: string,
  type?: string
): Promise<ApiResponse<ScheduleFromApi[]>> {
  try {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    if (type) params.set('type', type)

    const queryString = params.toString()
    const url = `/api/schedules${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const msg = errData.detail || errData.message || '일정 목록을 불러올 수 없습니다.'
      return { success: false, message: msg, data: [] }
    }

    const result = await response.json()
    return {
      success: true,
      data: result.data ?? [],
      count: result.count ?? 0,
    }
  } catch (error) {
    console.error('일정 목록 조회 오류:', error)
    return { success: false, message: '일정을 불러오는데 실패했습니다.', data: [] }
  }
}
