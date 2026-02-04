import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const url = `${API_BASE_URL}/api/boards/${boardId}/posts${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, message: '게시글 목록을 불러올 수 없습니다.', error: errorText, data: [] },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('게시글 목록 프록시 오류:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '게시글 목록 조회 중 오류 발생', data: [] },
      { status: 500 }
    )
  }
}
