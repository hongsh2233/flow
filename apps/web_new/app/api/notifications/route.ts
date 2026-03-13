import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const backendAccessToken = (session as { backendAccessToken?: string | null })?.backendAccessToken

    if (!backendAccessToken) {
      return NextResponse.json({ success: true, data: [], unread_count: 0 })
    }

    const url = `${API_BASE_URL}/api/notifications?limit=30`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${backendAccessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ success: true, data: [], unread_count: 0 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('알림 조회 프록시 오류:', error)
    return NextResponse.json({ success: true, data: [], unread_count: 0 })
  }
}
