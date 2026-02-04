// app/api/domestic-indices/route.ts
// 국내지수(코스피/코스닥)는 Yahoo Finance 직접 호출 시 오류가 있을 수 있어
// stock-bo 백엔드를 경유해 조회합니다.
import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
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
