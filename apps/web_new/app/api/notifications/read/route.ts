import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const backendAccessToken = (session as { backendAccessToken?: string | null })?.backendAccessToken

    if (!backendAccessToken) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${backendAccessToken}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('알림 읽음 프록시 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}
