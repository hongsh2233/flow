// app/api/fsc-stock-price/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // 모든 쿼리 파라미터를 백엔드로 전달
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.append(key, value)
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(
      `${API_BASE_URL}/api/fsc-stock-price?${params.toString()}`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      // 404 = 백엔드 미가동 또는 DB 데이터 없음
      // 502/503 = Railway "Application failed to respond" (BO 서비스 다운/타임아웃)
      // → 200 + 빈 데이터로 반환해 페이지 정상 로드
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        console.warn(
          `FSC Stock Price API (${response.status}): BO unavailable, using fallback:`,
          errorText.slice(0, 100)
        )
        return NextResponse.json({
          success: true,
          data: [],
          bas_dt: null,
          count: 0,
          message: 'FSC 주식시세를 불러올 수 없습니다.',
        })
      }
      console.error(`FSC Stock Price API error (${response.status}):`, errorText)
      return NextResponse.json(
        {
          success: false,
          message: 'FSC 주식시세 데이터 조회 실패',
          data: [],
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    // 네트워크 오류, BO 연결 실패 등 → 200 + 빈 데이터로 페이지 정상 로드
    console.warn('FSC 주식시세 조회 실패 (BO 연결 불가), 빈 데이터 반환:', error)
    return NextResponse.json({
      success: true,
      data: [],
      bas_dt: null,
      count: 0,
      message: 'FSC 주식시세를 불러올 수 없습니다.',
    })
  }
}

