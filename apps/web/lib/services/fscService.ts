/**
 * FSC 주식시세 서비스
 * Stock BO API 연동 - DB/백엔드 미준비 시 빈 데이터 반환
 */

import { API_BASE_URL, getAuthHeaders } from '@/lib/config/api'
import type { ApiResponse, FscStockPrice } from '@/lib/types/api'

export interface FetchFscStockPriceParams {
  limit?: number
  bas_dt?: string
  min_flt_rt?: number
  mrkt_ctg?: string
  order_by?: string
  order_direction?: 'asc' | 'desc'
  [key: string]: string | number | undefined
}

/**
 * FSC 주식시세 조회
 */
export async function fetchFscStockPrice(
  params: FetchFscStockPriceParams = {}
): Promise<ApiResponse<FscStockPrice[]>> {
  try {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })

    const response = await fetch(
      `${API_BASE_URL}/api/fsc-stock-price?${searchParams.toString()}`,
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
        message: 'FSC 주식시세를 불러올 수 없습니다.',
        error: errorText,
        data: [],
      }
    }

    const data = await response.json()
    const items = data.data ?? (Array.isArray(data) ? data : [])
    return { success: true, data: items }
  } catch (error) {
    console.error('FSC 주식시세 조회 오류:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'FSC 주식시세를 불러오는데 실패했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    }
  }
}
