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
      // 401(인증), 500(서버 오류) → 200 + 빈 목록으로 반환해 페이지 정상 표시
      if (response.status === 401 || response.status === 500) {
        return NextResponse.json({ success: true, data: [] })
      }
      console.error(`[게시판 목록 API] Admin 서버 응답 오류 (${response.status}):`, errorText)
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
    return NextResponse.json({ success: true, data: [] })
  }
}
