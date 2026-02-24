import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

function makeHeaders() {
  const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiSecretKey) headers['X-API-KEY'] = apiSecretKey
  return headers
}

/** FCM 토큰 등록 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || ''
    if (!email) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ success: false, message: 'token이 필요합니다.' }, { status: 400 })
    }

    const url = `${API_BASE_URL}/api/fcm-token`
    const response = await fetch(url, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ email, token }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('FCM 토큰 등록 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}

/** FCM 토큰 삭제 (알림 OFF) */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || ''
    if (!email) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { token } = await request.json()
    const url = `${API_BASE_URL}/api/fcm-token`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: makeHeaders(),
      body: JSON.stringify({ email, token }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('FCM 토큰 삭제 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}
