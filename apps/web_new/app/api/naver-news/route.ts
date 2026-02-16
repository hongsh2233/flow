import { NextRequest, NextResponse } from 'next/server'

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || ''
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || ''

interface NaverNewsItem {
  title: string
  originallink: string
  link: string
  description: string
  pubDate: string
}

interface NaverNewsResponse {
  items: NaverNewsItem[]
  total: number
  start: number
  display: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query') || '주식'
    const display = searchParams.get('display') || '10'
    const start = searchParams.get('start') || '1'
    const sort = searchParams.get('sort') || 'date'

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      console.error('Naver API credentials are missing')
      return NextResponse.json(
        {
          success: false,
          message: '네이버 API 인증 정보가 설정되지 않았습니다.',
          data: [],
        },
        { status: 500 }
      )
    }

    const url = new URL('https://openapi.naver.com/v1/search/news.json')
    url.searchParams.append('query', query)
    url.searchParams.append('display', display)
    url.searchParams.append('start', start)
    url.searchParams.append('sort', sort)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID.trim(),
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET.trim(),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = '네이버 뉴스 API 호출에 실패했습니다.'
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.errorCode === '024') {
          errorMessage = '네이버 API 인증에 실패했습니다. Client ID와 Secret을 확인해주세요.'
        } else {
          errorMessage = errorData.errorMessage || errorMessage
        }
      } catch {
        // ignore
      }
      return NextResponse.json(
        { success: false, message: errorMessage, data: [] },
        { status: response.status }
      )
    }

    const data: NaverNewsResponse = await response.json()

    const cleanedItems = data.items.map((item) => ({
      title: item.title.replace(/<[^>]*>/g, '').trim(),
      originallink: item.originallink,
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, '').trim(),
      pubDate: item.pubDate,
    }))

    return NextResponse.json({
      success: true,
      message: '뉴스를 성공적으로 가져왔습니다.',
      data: cleanedItems,
      total: data.total,
    })
  } catch (error) {
    console.error('Naver News API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '뉴스를 가져오는 중 오류가 발생했습니다.',
        data: [],
      },
      { status: 500 }
    )
  }
}
