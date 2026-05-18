import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: '로그인 후 이용해 주세요.' },
        { status: 401 }
      )
    }

    const { boardId } = await params
    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json(
        { success: false, message: '내용을 입력해 주세요.' },
        { status: 400 }
      )
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const payload = JSON.stringify({
      content,
      title: body.title || undefined,
      author_email: session.user.email,
      reference_text: body.reference_text || undefined,
      use_ai_summary: body.use_ai_summary || false,
    })

    const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/posts`, {
      method: 'POST',
      headers,
      body: payload,
      redirect: 'error',
    })

    const data = await response.json()
    if (!response.ok) {
      // Pydantic v2 배열 에러 → 읽기 좋은 문자열로 변환
      let message = '게시글 작성에 실패했습니다.'
      if (Array.isArray(data.detail)) {
        message = data.detail.map((e: { msg?: string }) => e.msg || '').join(', ') || message
      } else if (typeof data.detail === 'string') {
        message = data.detail
      }
      return NextResponse.json(
        { success: false, message },
        { status: response.status }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    const isRedirectError = error instanceof TypeError && String(error).includes('redirect')
    console.error('게시글 작성 프록시 오류:', isRedirectError ? '백엔드 redirect 감지 (body 손실 가능)' : error)
    return NextResponse.json(
      { success: false, message: isRedirectError ? '서버 연결 오류 (redirect). 관리자에게 문의하세요.' : '게시글 작성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    const session = await getServerSession(authOptions)

    const apiSecretKey = process.env.X_API_KEY || ''

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
