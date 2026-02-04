/**
 * 재무제표 서비스
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

import type { FinaStatType } from '@/lib/types/api'

export interface FetchFinaStatResult {
  error?: string
  result?: {
    summ?: { data: Record<string, unknown>[] }
    bs?: { data: Record<string, unknown>[] }
    inco?: { data: Record<string, unknown>[] }
  }
}

/**
 * 재무제표 조회
 * @param crno 법인등록번호
 * @param bizYear 사업연도
 * @param types 조회할 항목 ('summ' | 'bs' | 'inco')
 */
export async function fetchFinaStat(
  crno: string,
  bizYear: string,
  types: FinaStatType[]
): Promise<FetchFinaStatResult> {
  try {
    const params = new URLSearchParams({
      crno: crno.trim(),
      biz_year: bizYear.trim(),
    })
    types.forEach((t) => params.append('types', t))

    const response = await fetch(
      `/api/fina-stat?${params}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        error: '재무제표를 불러올 수 없습니다.',
        result: undefined,
      }
    }

    const data = await response.json()
    if (data.error) {
      return { error: data.error, result: undefined }
    }

    const result: FetchFinaStatResult['result'] = {}
    if (data.summ?.data) result.summ = { data: data.summ.data }
    if (data.bs?.data) result.bs = { data: data.bs.data }
    if (data.inco?.data) result.inco = { data: data.inco.data }

    return { result }
  } catch (error) {
    console.error('재무제표 조회 오류:', error)
    return {
      error: error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.',
      result: undefined,
    }
  }
}
