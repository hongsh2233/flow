import { NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET() {
  try {
    const apiSecretKey = process.env.X_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiSecretKey) {
      headers['X-API-KEY'] = apiSecretKey
    }

    const response = await fetch(`${API_BASE_URL}/api/popups/active`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ success: true, data: [] })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('팝업 조회 프록시 오류:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
