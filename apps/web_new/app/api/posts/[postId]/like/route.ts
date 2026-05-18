import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const backendToken =
      (session as { backendAccessToken?: string | null } | null)?.backendAccessToken ?? null
    if (!backendToken) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { postId } = await params
    const apiSecretKey = process.env.X_API_KEY || ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendToken}`,
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
      method: 'POST',
      headers,
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: (data as { detail?: string }).detail || '좋아요 처리에 실패했습니다.',
        },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('게시글 좋아요 프록시 오류:', e)
    return NextResponse.json(
      { success: false, message: '좋아요 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
