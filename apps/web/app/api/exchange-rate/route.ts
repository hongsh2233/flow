import { NextRequest, NextResponse } from 'next/server'

interface YahooFinanceResponse {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number
        previousClose?: number
        chartPreviousClose?: number
        symbol: string
        shortName?: string
      }
    }>
    error?: any
  }
}

// 조회할 환율 심볼 목록 (Yahoo Finance 기준)
const EXCHANGE_RATES = [
  { name: '미국 USD', symbol: 'KRW=X' },
  { name: '일본 JPY (100엔)', symbol: 'JPYKRW=X' }, // Yahoo는 1엔 단위일 수 있으므로 확인 필요, 보통 JPYKRW=X는 1엔 기준
  { name: '유럽 EUR', symbol: 'EURKRW=X' },
]

async function fetchRate(item: { name: string; symbol: string }) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1d&range=1d`
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch ${item.symbol}:`, response.status, response.statusText)
      return null
    }

    const data: YahooFinanceResponse = await response.json()

    // 에러 체크
    if (data.chart.error || !data.chart.result || data.chart.result.length === 0) {
      console.error(`Error in response for ${item.symbol}:`, data.chart.error)
      return null
    }

    const result = data.chart.result[0]
    if (!result || !result.meta) {
      console.error(`Invalid data structure for ${item.symbol}`)
      return null
    }

    const meta = result.meta
    // 더 유연한 가격 추출
    const price = meta.regularMarketPrice || meta.chartPreviousClose || meta.previousClose
    const prev = meta.previousClose || meta.chartPreviousClose || price

    // 가격 검증
    if (price === undefined || price === null || isNaN(price)) {
      console.error(`Invalid price for ${item.symbol}:`, { price, meta })
      return null
    }

    let displayPrice = price
    let displayName = item.name
    let prevPrice = prev || price

    // [보정] JPY는 보통 100엔 단위로 표기하므로, 값이 작으면(15원 이하) 100을 곱해서 표기하는 관례 적용
    if (item.symbol === 'JPYKRW=X' && price < 20) {
      displayPrice = price * 100
      displayName = '일본 JPY (100엔)'
      prevPrice = (prev || price) * 100
    }

    // 등락 계산
    let change = 0
    let percent = 0
    
    if (prevPrice !== undefined && prevPrice !== null && !isNaN(prevPrice) && prevPrice !== 0) {
      change = displayPrice - prevPrice
      percent = (change / prevPrice) * 100
    }

    // 계산 결과 검증
    if (isNaN(change) || isNaN(percent)) {
      console.error(`Invalid calculation for ${item.symbol}:`, { change, percent, displayPrice, prevPrice })
      change = 0
      percent = 0
    }

    return {
      name: displayName,
      value: displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2),
      percent: percent > 0 ? `+${percent.toFixed(2)}%` : `${percent.toFixed(2)}%`,
    }
  } catch (error) {
    console.error(`Error fetching ${item.symbol}:`, error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const promises = EXCHANGE_RATES.map(item => fetchRate(item))
    const results = await Promise.all(promises)
    const validResults = results.filter(res => res !== null)

    console.log(`환율 API: ${validResults.length}/${EXCHANGE_RATES.length}개 성공`)

    return NextResponse.json({
      success: true,
      data: validResults,
    })
  } catch (error) {
    console.error('Exchange Rate API Error:', error)
    return NextResponse.json(
      { success: false, message: '환율 정보를 가져오는데 실패했습니다.', data: [] },
      { status: 500 }
    )
  }
}
