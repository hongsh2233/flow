import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const url = `${API_BASE_URL}/api/fina-stat${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: '재무제표를 불러올 수 없습니다.' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('재무제표 프록시 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '재무제표 조회 중 오류 발생' },
      { status: 500 }
    )
  }
}
