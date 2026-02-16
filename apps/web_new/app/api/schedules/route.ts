import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()

    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const url = `${API_BASE_URL}/api/schedules${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      let detail = '일정 목록을 불러올 수 없습니다.'
      try {
        const errJson = JSON.parse(errorText)
        detail = errJson.detail || errJson.message || detail
      } catch {
        detail = errorText || detail
      }
      return NextResponse.json(
        { success: false, message: detail, error: errorText, data: [], count: 0 },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('일정 목록 프록시 오류:', error)
    const msg = error instanceof Error ? error.message : '네트워크 오류'
    return NextResponse.json(
      { success: false, message: `Admin API 연결 실패: ${msg}. localhost:8080에서 Admin 서버가 실행 중인지 확인해주세요.`, data: [], count: 0 },
      { status: 502 }
    )
  }
}
