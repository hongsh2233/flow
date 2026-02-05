import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bannerType = searchParams.get('type') || 'banner'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(`${API_BASE_URL}/api/banners?banner_type=${bannerType}`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('배너 API 호출 실패:', errorText)
      return NextResponse.json(
        { success: false, data: [], count: 0, error: '배너를 불러올 수 없습니다.' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('배너 API 에러:', error)
    return NextResponse.json(
      { success: false, data: [], count: 0, error: '배너를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

