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
    const backendToken = (session as { backendAccessToken?: string | null } | null)
      ?.backendAccessToken
    if (backendToken) {
      headers['Authorization'] = `Bearer ${backendToken}`
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

    const isMemberOnly = data.data?.is_member_only === 'true'
    const memberOnlyGrade = data.data?.member_only_grade || 'all'
    const userGrade = (session?.user as { grade?: string })?.grade

    const canAccessByGrade = (required: string) => {
      if (required === 'all') return true
      const hierarchy = ['regular', 'vip', 'family']
      const userLevel = hierarchy.indexOf(userGrade || 'regular')
      const requiredLevel = hierarchy.indexOf(required)
      return userLevel >= requiredLevel && userLevel >= 0
    }

    if (isMemberOnly && !session) {
      data.data.content = ''
      data.data._blocked = true
      data.data._block_reason = 'member_only'
    } else if (isMemberOnly && session && !canAccessByGrade(memberOnlyGrade)) {
      data.data.content = ''
      data.data._blocked = true
      data.data._block_reason = 'grade_required'
    }

    // 전체공개 + 일부노출 + 비로그인: 100자 미리보기 + 회원가입 유도
    const publicVisibility = data.data?.public_visibility || 'full'
    if (
      data.data?.is_member_only !== 'true' &&
      publicVisibility === 'partial' &&
      !session
    ) {
      const stripHtml = (html: string) =>
        html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
      const plain = stripHtml(data.data.content || '')
      data.data.content = plain.length > 100 ? plain.slice(0, 100) + '…' : plain
      data.data._partial = true
      data.data._block_reason = 'signup_needed'
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
