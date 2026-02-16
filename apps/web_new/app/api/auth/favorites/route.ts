import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({
        success: true,
        favorite_stocks: [],
        message: '로그인 후 이용해주세요.',
      })
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) headers['X-API-KEY'] = API_SECRET_KEY

    const url = `${API_BASE_URL}/api/auth/member/favorites?email=${encodeURIComponent(session.user.email)}`
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { success: false, favorite_stocks: [], message: data.detail || '관심종목을 불러올 수 없습니다.' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('관심종목 API 프록시 오류:', error)
    return NextResponse.json(
      { success: false, favorite_stocks: [], message: '관심종목을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
