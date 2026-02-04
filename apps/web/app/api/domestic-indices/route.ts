// app/api/domestic-indices/route.ts
// 국내지수(코스피/코스닥)는 Yahoo Finance 직접 호출 시 오류가 있을 수 있어
// stock-bo 백엔드를 경유해 조회합니다.
import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    // API route에서는 런타임에 환경 변수를 직접 읽어야 함
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    } else {
      console.warn('[국내지수 API] NEXT_PUBLIC_X_API_KEY가 설정되지 않았습니다.')
    }

    const response = await fetch(`${API_BASE_URL}/api/domestic-indices`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('BO domestic-indices 응답 오류:', response.status, response.statusText)
      return NextResponse.json(
        { success: false, message: '국내 지수 조회 실패', data: [] },
        { status: response.status }
      )
    }

    const json = await response.json()

    if (!json.success) {
      return NextResponse.json(
        { success: false, message: json.message || '국내 지수 조회 실패', data: [] },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: json.success,
      data: json.data ?? [],
      timestamp: json.timestamp ?? '',
    })
  } catch (error) {
    console.error('Domestic Indices API Error (BO proxy):', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch indices', data: [] },
      { status: 500 }
    )
  }
}
