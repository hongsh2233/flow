import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const qs = sp.toString()
    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['X-API-KEY'] = apiKey

    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/stock-terms${qs ? `?${qs}` : ''}`
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' })

    if (!res.ok) {
      return NextResponse.json({ items: [], total: 0 }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 502 })
  }
}
