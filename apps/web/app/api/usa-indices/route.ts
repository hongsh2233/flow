import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

interface UsaIndex {
  name: string
  symbol: string
  value: string
  change: string
  percent: string
}

/** stock-bo 해외지수 API 응답 항목 (price, change, change_percent) */
interface ForeignIndexItem {
  symbol: string
  name: string
  market?: string
  price: number | null
  change: number | null
  change_percent: number | null
  error?: string
}

interface ForeignIndicesResponse {
  success: boolean
  data: ForeignIndexItem[]
  count?: number
}

/**
 * 해외지수는 Vercel에서 Yahoo Finance 직접 호출 시 CORS/차단 이슈가 있을 수 있어
 * stock-bo 백엔드를 경유해 조회합니다.
 */
export async function GET(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(`${API_BASE_URL}/api/foreign-indices`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('BO foreign-indices 응답 오류:', response.status, response.statusText)
      return NextResponse.json(
        {
          success: false,
          message: '해외지수 데이터를 가져오는데 실패했습니다.',
          data: [],
        },
        { status: response.status }
      )
    }

    const json: ForeignIndicesResponse = await response.json()

    if (!json.success || !Array.isArray(json.data)) {
      return NextResponse.json(
        {
          success: false,
          message: json.success === false ? '해외지수 조회 실패' : '지수를 가져오는데 실패했습니다.',
          data: [],
        },
        { status: 500 }
      )
    }

    const validResults: UsaIndex[] = json.data
      .filter((item): item is ForeignIndexItem & { price: number; change: number; change_percent: number } => {
        return (
          item != null &&
          !('error' in item && item.error) &&
          typeof item.price === 'number' &&
          !Number.isNaN(item.price) &&
          typeof item.change === 'number' &&
          typeof item.change_percent === 'number'
        )
      })
      .map((item) => ({
        name: item.name,
        symbol: item.symbol,
        value: item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: item.change >= 0 ? `+${item.change.toFixed(2)}` : item.change.toFixed(2),
        percent: item.change_percent >= 0 ? `+${item.change_percent.toFixed(2)}%` : `${item.change_percent.toFixed(2)}%`,
      }))

    return NextResponse.json({
      success: true,
      message: '지수를 성공적으로 가져왔습니다.',
      data: validResults,
    })
  } catch (error) {
    console.error('USA Indices API Error (BO proxy):', error)
    return NextResponse.json(
      {
        success: false,
        message: '지수를 가져오는 중 오류가 발생했습니다.',
        data: [],
      },
      { status: 500 }
    )
  }
}
