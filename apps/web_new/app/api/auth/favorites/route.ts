import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

async function fetchBoFavorites(method: string, body?: object) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, favorite_stocks: [], message: '로그인이 필요합니다.' }, { status: 401 })
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_SECRET_KEY) headers['X-API-KEY'] = API_SECRET_KEY
  const opts: RequestInit = { method, headers, cache: 'no-store' }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE_URL}/api/auth/member/favorites`, opts)
  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json(
      { success: false, favorite_stocks: [], message: data.detail || '요청 처리 실패' },
      { status: res.status }
    )
  }
  return NextResponse.json(data)
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stock_code } = body || {}
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, favorite_stocks: [], message: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (!stock_code) {
      return NextResponse.json({ success: false, favorite_stocks: [], message: 'stock_code가 필요합니다.' }, { status: 400 })
    }
    return fetchBoFavorites('POST', { email: session.user.email, stock_code })
  } catch (error) {
    console.error('관심종목 추가 오류:', error)
    return NextResponse.json(
      { success: false, favorite_stocks: [], message: '관심종목 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { stock_code } = body || {}
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, favorite_stocks: [], message: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (!stock_code) {
      return NextResponse.json({ success: false, favorite_stocks: [], message: 'stock_code가 필요합니다.' }, { status: 400 })
    }
    return fetchBoFavorites('DELETE', { email: session.user.email, stock_code })
  } catch (error) {
    console.error('관심종목 삭제 오류:', error)
    return NextResponse.json(
      { success: false, favorite_stocks: [], message: '관심종목 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
