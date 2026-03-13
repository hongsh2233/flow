import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin API Base URL - Railway 배포 시 Variables에서 설정 필수
 * - API_BASE_URL: 서버 전용 (권장)
 * - NEXT_PUBLIC_API_BASE_URL: 클라이언트/서버 공용
 */
function getApiBaseUrl(): string {
  const base = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''
  return base.replace(/\/+$/, '')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()

    const apiSecretKey =
      process.env.NEXT_PUBLIC_X_API_KEY ||
      process.env.X_API_KEY ||
      ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const baseUrl = getApiBaseUrl()
    const url = `${baseUrl}/api/schedules${queryString ? `?${queryString}` : ''}`
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
    const baseUrl = getApiBaseUrl()
    console.error('일정 목록 프록시 오류:', error)
    const msg = error instanceof Error ? error.message : '네트워크 오류'
    return NextResponse.json(
      {
        success: false,
        message: `Admin API 연결 실패: ${msg}. Railway 배포 시 web_new 서비스 Variables에 NEXT_PUBLIC_API_BASE_URL(Admin URL)과 NEXT_PUBLIC_X_API_KEY 설정 확인. (현재 base: ${baseUrl})`,
        data: [],
        count: 0,
      },
      { status: 502 }
    )
  }
}
