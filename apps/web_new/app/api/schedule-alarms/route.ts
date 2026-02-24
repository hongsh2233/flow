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

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || ''
    if (!email) return NextResponse.json({ success: true, data: [] })

    const url = `${API_BASE_URL}/api/schedule-alarms?email=${encodeURIComponent(email)}`
    const response = await fetch(url, { method: 'GET', headers: makeHeaders(), cache: 'no-store' })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('일정 알림 신청 목록 조회 오류:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || ''
    if (!email) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const url = `${API_BASE_URL}/api/schedule-alarms?email=${encodeURIComponent(email)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('일정 알림 신청 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || ''
    if (!email) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { schedule_id } = await request.json()
    const url = `${API_BASE_URL}/api/schedule-alarms/${schedule_id}?email=${encodeURIComponent(email)}`
    const response = await fetch(url, { method: 'DELETE', headers: makeHeaders() })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('일정 알림 취소 오류:', error)
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 })
  }
}
