import { NextResponse } from 'next/server'

function getApiBaseUrl(): string {
  const base = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''
  return base.replace(/\/+$/, '')
}

/**
 * 당일 메인 팝업 표시 대상 일정 조회 (show_main_popup=true)
 */
export async function GET() {
  try {
    const apiSecretKey =
      process.env.X_API_KEY ||
      process.env.X_API_KEY ||
      ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const baseUrl = getApiBaseUrl()
    const response = await fetch(`${baseUrl}/api/schedules/today-popup`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, data: [], count: 0 },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('today-popup 일정 조회 오류:', error)
    return NextResponse.json(
      { success: false, data: [], count: 0 },
      { status: 500 }
    )
  }
}
