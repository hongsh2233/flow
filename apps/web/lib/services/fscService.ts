/**
 * FSC 주식시세 서비스
 * Stock BO API 연동 - DB/백엔드 미준비 시 빈 데이터 반환
 */

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
 * Next.js API route를 통해 admin 서버로 프록시
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

    // Next.js API route를 통해 호출 (CORS 문제 방지)
    const response = await fetch(
      `/api/fsc-stock-price?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      // 404 = 백엔드 미가동 또는 DB에 데이터 없음
      // 502/503 = Railway "Application failed to respond" (BO 서비스 다운)
      // → 빈 데이터로 처리해 페이지는 정상 로드
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        return { success: true, data: [] }
      }
      console.error('FSC 주식시세 조회 실패:', response.status, errorText)
      return {
        success: false,
        message: 'FSC 주식시세를 불러올 수 없습니다.',
        error: errorText,
        data: [],
      }
    }

    const data = await response.json()
    // API route가 반환하는 형식에 맞게 처리
    if (data.success === false) {
      return {
        success: false,
        message: data.message || 'FSC 주식시세를 불러올 수 없습니다.',
        error: data.error,
        data: [],
      }
    }

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
