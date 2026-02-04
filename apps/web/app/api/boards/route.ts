import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    // API route에서는 런타임에 환경 변수를 직접 읽어야 함
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    } else {
      console.warn('[게시판 목록 API] NEXT_PUBLIC_X_API_KEY가 설정되지 않았습니다.')
    }

    const response = await fetch(`${API_BASE_URL}/api/boards`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[게시판 목록 API] Admin 서버 응답 오류 (${response.status}):`, errorText)
      console.error(`[게시판 목록 API] 요청 URL: ${API_BASE_URL}/api/boards`)
      console.error(`[게시판 목록 API] API_KEY 설정 여부: ${apiSecretKey ? '설정됨' : '설정되지 않음'}`)
      return NextResponse.json(
        { 
          success: false, 
          message: '게시판 목록을 불러올 수 없습니다.', 
          error: errorText 
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('게시판 목록 프록시 오류:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '게시판 목록 조회 중 오류 발생', data: [] },
      { status: 500 }
    )
  }
}
