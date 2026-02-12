import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const response = await fetch(`${API_BASE_URL}/api/boards`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 500) {
        return NextResponse.json({ success: true, data: [] })
      }
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, message: '게시판 목록을 불러올 수 없습니다.', error: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('게시판 목록 프록시 오류:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
