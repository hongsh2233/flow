import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params
    const session = await getServerSession(authOptions)

    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, message: '게시글을 불러올 수 없습니다.', error: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.data?.is_member_only === 'true' && !session) {
      data.data.content = ''
      data.data._blocked = true
      data.data._block_reason = 'member_only'
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('게시글 상세 프록시 오류:', error)
    return NextResponse.json(
      { success: false, message: '게시글 조회 중 오류 발생' },
      { status: 500 }
    )
  }
}
