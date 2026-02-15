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
      if (response.status === 401 || response.status === 500) {
        return NextResponse.json({ success: true, data: [], count: 0 })
      }
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, message: '일정 목록을 불러올 수 없습니다.', error: errorText, data: [] },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('일정 목록 프록시 오류:', error)
    return NextResponse.json({ success: true, data: [], count: 0 })
  }
}
