// app/api/fsc-stock-price/route.ts
import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const NEXT_PUBLIC_X_API_KEY = process.env.NEXT_PUBLIC_X_API_KEY || ''

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

    if (NEXT_PUBLIC_X_API_KEY) {
      headers['X-API-KEY'] = NEXT_PUBLIC_X_API_KEY
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
    console.error('FSC 주식시세 데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'FSC 주식시세 데이터 조회 중 오류 발생',
        data: [],
      },
      { status: 500 }
    )
  }
}

