/**
 * KRX 데이터 서비스
 * Stock BO API 연동 - DB/백엔드 미준비 시 빈 데이터 반환
 */

import { API_BASE_URL, getAuthHeaders } from '@/lib/config/api'
import type { ApiResponse, KrxData } from '@/lib/types/api'

export interface FetchKrxDataParams {
  data_type?: string
  bas_dd?: string
  [key: string]: string | number | undefined
}

/**
 * KRX 데이터 조회
 */
export async function fetchKrxData(
  params: FetchKrxDataParams = {}
): Promise<ApiResponse<KrxData[]>> {
  try {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })

    const response = await fetch(
      `${API_BASE_URL}/api/krx-data?${searchParams.toString()}`,
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
        message: 'KRX 데이터를 불러올 수 없습니다.',
        error: errorText,
        data: [],
      }
    }

    const data = await response.json()
    const items = data.data ?? data.items ?? (Array.isArray(data) ? data : [])
    return { success: true, data: items }
  } catch (error) {
    console.error('KRX 데이터 조회 오류:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'KRX 데이터를 불러오는데 실패했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    }
  }
}
