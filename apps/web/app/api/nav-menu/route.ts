import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

export async function GET(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_SECRET_KEY) {
      headers['X-API-KEY'] = API_SECRET_KEY
    }

    const response = await fetch(`${API_BASE_URL}/api/nav-menu`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, data: [] },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('메뉴 프록시 오류:', error)
    return NextResponse.json(
      { success: false, data: [] },
      { status: 500 }
    )
  }
}
