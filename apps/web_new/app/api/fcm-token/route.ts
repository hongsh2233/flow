import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

function makeHeaders() {
  const apiSecretKey = process.env.X_API_KEY || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiSecretKey) headers['X-API-KEY'] = apiSecretKey
  return headers
}

/** FCM 토큰 등록 (로그인 여부 무관, 디바이스 단위 등록) */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || undefined  // 비로그인 시 undefined

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ success: false, message: 'token이 필요합니다.' }, { status: 400 })
    }

    const url = `${API_BASE_URL}/api/fcm-token`
    const response = await fetch(url, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ token, ...(email ? { email } : {}) }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('FCM 토큰 등록 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}

/** FCM 토큰 삭제 (알림 OFF)
 * token 있으면 특정 토큰만 삭제, 없으면 해당 email의 모든 토큰 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || ''
    if (!email) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    let token: string | undefined
    try {
      const body = await request.json()
      token = body?.token || undefined
    } catch {
      // body 없어도 email로 전체 삭제
    }

    const url = `${API_BASE_URL}/api/fcm-token`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: makeHeaders(),
      body: JSON.stringify({ email, ...(token ? { token } : {}) }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('FCM 토큰 삭제 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}
