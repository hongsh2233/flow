// app/api/stock-to-corp/route.ts
import { NextRequest, NextResponse } from 'next/server'

const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stockCode = searchParams.get('stockCode') // 종목코드 (예: 005930)

  if (!stockCode) {
    return NextResponse.json(
      { success: false, message: 'stockCode is required' },
      { status: 400 }
    )
  }

  if (!SERVICE_KEY) {
    console.warn(
      '[stock-to-corp] API key not configured. Please set DATA_GO_KR_API_KEY in .env.local'
    )
    return NextResponse.json(
      {
        success: false,
        message:
          'API key not configured. Please set DATA_GO_KR_API_KEY in .env.local',
      },
      { status: 500 }
    )
  }

  try {
    // 금융위원회 주식시세정보 조회 API
    // 참고: https://www.data.go.kr/data/15094808/openapi.do
    const url = `http://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?serviceKey=${SERVICE_KEY}&numOfRows=10&pageNo=1&resultType=json&likeSrtnCd=${stockCode}`

    console.log('[stock-to-corp] API 호출:', url.replace(SERVICE_KEY, '***'))

    const response = await fetch(url)
    const data = await response.json()

    // 보안: API 응답 전체는 콘솔에 출력하지 않음 (민감 정보 포함 가능)
    console.log('[stock-to-corp] API 응답 수신 완료')

    // 에러 체크
    if (data?.response?.header?.resultCode !== '00') {
      console.error('[stock-to-corp] API 에러:', data?.response?.header)
      return NextResponse.json({
        success: false,
        message: `API Error: ${data?.response?.header?.resultMsg || 'Unknown error'}`,
      })
    }

    // 응답 구조: response.body.items.item
    const items = data?.response?.body?.items?.item
    const item = Array.isArray(items) ? items[0] : items

    if (!item) {
      console.warn('[stock-to-corp] 데이터 없음:', stockCode)
      return NextResponse.json({
        success: false,
        message: 'No data found for this stock code',
      })
    }

    console.log('[stock-to-corp] 조회 성공:', {
      stockCode: item.srtnCd,
      corpName: item.itmsNm,
      crno: item.crno,
    })

    return NextResponse.json({
      success: true,
      data: {
        stockCode: item.srtnCd,
        corpName: item.itmsNm,
        crno: item.crno, // 법인등록번호
      },
    })
  } catch (error) {
    console.error('[stock-to-corp] API 호출 실패:', error)
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch corporation number: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
}
