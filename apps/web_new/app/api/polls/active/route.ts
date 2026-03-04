import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiSecretKey) headers['X-API-KEY'] = apiSecretKey

    const response = await fetch(`${API_BASE_URL}/api/polls/active`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ success: true, data: null })
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('진행중인 투표 조회 오류:', error)
    return NextResponse.json({ success: true, data: null })
  }
}
