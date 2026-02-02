// app/api/naver-ranking/route.ts
import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const API_SECRET_KEY = process.env.NEXT_PUBLIC_X_API_KEY || ''

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rankingType = searchParams.get('ranking_type') || 'volume'
    const marketType = searchParams.get('market_type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '10')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(
      `${API_BASE_URL}/api/naver-stock-ranking?ranking_type=${rankingType}&market_type=${marketType}&limit=${limit}`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: '랭킹 데이터 조회 실패',
          data: [],
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('랭킹 데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '랭킹 데이터 조회 중 오류 발생',
        data: [],
      },
      { status: 500 }
    )
  }
}

