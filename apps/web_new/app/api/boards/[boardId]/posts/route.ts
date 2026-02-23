import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    const session = await getServerSession(authOptions)

    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const url = `${API_BASE_URL}/api/boards/${boardId}/posts${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      if (response.status === 404 || response.status === 401 || response.status === 500) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total_count: 0, total_pages: 0 },
        })
      }
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, message: '게시글 목록을 불러올 수 없습니다.', error: errorText, data: [] },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!session && Array.isArray(data.data)) {
      data.data = data.data.map((post: Record<string, unknown>) => {
        if (post.is_member_only === 'true') {
          return { ...post, content: '', _blocked: true, _block_reason: 'member_only' }
        }
        return post
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('게시글 목록 프록시 오류:', error)
    return NextResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total_count: 0, total_pages: 0 },
    })
  }
}
