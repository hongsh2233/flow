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
      // 404 = 백엔드 미가동 또는 설정 없음
      // 502/503 = Railway "Application failed to respond" (BO 서비스 다운/타임아웃)
      // → 200 + 빈 항목으로 반환해 메인 페이지 정상 로드
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        console.warn(
          `Main page config API (${response.status}): BO unavailable, using fallback:`,
          errorText.slice(0, 100)
        )
        return NextResponse.json({
          success: true,
          message: '메인 페이지 설정을 불러올 수 없어 기본 구성을 사용합니다.',
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
    // 네트워크 오류, BO 연결 실패 등 → 200 + 빈 항목으로 메인 페이지 정상 로드
    console.warn('메인 페이지 설정 조회 실패 (BO 연결 불가), 기본 구성 사용:', error)
    return NextResponse.json({
      success: true,
      message: '메인 페이지 설정을 불러올 수 없어 기본 구성을 사용합니다.',
      items: [],
    })
  }
}

