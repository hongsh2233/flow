import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()

    // API route에서는 런타임에 환경 변수를 직접 읽어야 함
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    } else {
      console.warn('[게시글 목록 API] NEXT_PUBLIC_X_API_KEY가 설정되지 않았습니다.')
    }

    const url = `${API_BASE_URL}/api/boards/${boardId}/posts${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      // 404(게시판 없음), 401(인증 실패), 500(서버 오류) → 200 + 빈 목록으로 반환해 페이지 정상 표시
      if (response.status === 404 || response.status === 401 || response.status === 500) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total_count: 0, total_pages: 0 },
        })
      }
      console.error(`[게시글 목록 API] Admin 서버 응답 오류 (${response.status}):`, errorText)
      return NextResponse.json(
        { 
          success: false, 
          message: '게시글 목록을 불러올 수 없습니다.', 
          error: errorText, 
          data: [] 
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('게시글 목록 프록시 오류:', error)
    // 연결 실패 등 → 200 + 빈 목록으로 반환해 페이지는 정상 표시
    return NextResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total_count: 0, total_pages: 0 },
    })
  }
}
