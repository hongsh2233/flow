// app/api/main-page-config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(
      `${API_BASE_URL}/api/main-page-config`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      // 404 = 백엔드 미가동 또는 설정 없음 → 200 + 빈 항목으로 반환해 메인 페이지 정상 로드
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: '메인 페이지 설정이 없습니다.',
          items: [],
        })
      }
      console.error(`Main page config API error (${response.status}):`, errorText)
      return NextResponse.json(
        {
          success: false,
          message: '메인 페이지 설정 조회 실패',
          items: [],
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('메인 페이지 설정 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '메인 페이지 설정 조회 중 오류 발생',
        items: [],
      },
      { status: 500 }
    )
  }
}

