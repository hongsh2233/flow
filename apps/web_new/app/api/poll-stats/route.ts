import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const pollId = searchParams.get('poll_id')
    if (!pollId) {
      return NextResponse.json(
        { success: false, message: 'poll_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const apiSecretKey = process.env.X_API_KEY || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiSecretKey) headers['X-API-KEY'] = apiSecretKey

    const response = await fetch(
      `${API_BASE_URL}/api/poll-stats?poll_id=${encodeURIComponent(pollId)}`,
      { method: 'GET', headers, cache: 'no-store' }
    )

    if (!response.ok) {
      return NextResponse.json(
        { success: true, poll_id: parseInt(pollId, 10), total_votes: 0, options: [] }
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('투표 통계 조회 오류:', error)
    return NextResponse.json(
      { success: true, poll_id: 0, total_votes: 0, options: [] }
    )
  }
}
