import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function POST(request: NextRequest) {
  try {
    const apiSecretKey = process.env.X_API_KEY || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiSecretKey) headers['X-API-KEY'] = apiSecretKey

    const body = await request.json()
    const response = await fetch(`${API_BASE_URL}/api/poll-vote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, message: '투표 처리에 실패했습니다.', error: errText },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('투표 프록시 오류:', error)
    return NextResponse.json(
      { success: false, message: '투표 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
