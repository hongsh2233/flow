import { NextResponse } from 'next/server'

interface Quote {
  id: number
  text: string
  author: string
}

// 주식 투자 관련 명언 모음
const QUOTES: Quote[] = [
  {
    id: 1,
    text: '잃지 마라! 그리고 첫 번째 규칙을 잊지 마라!',
    author: '워렌 버핏',
  },
  {
    id: 2,
    text: '시장이 두려움에 빠져있을 때 탐욕스러워지고, 시장이 탐욕에 빠져있을 때 두려워하라.',
    author: '워렌 버핏',
  },
  {
    id: 3,
    text: '가장 좋은 투자 시기는 다른 사람들이 두려워할 때다.',
    author: '워렌 버핏',
  },
  {
    id: 4,
    text: '장기 투자자의 가장 큰 적은 시장이 아니라 자신의 감정이다.',
    author: '벤저민 그레이엄',
  },
  {
    id: 5,
    text: '투자는 단순하지만 쉽지 않다.',
    author: '워렌 버핏',
  },
  {
    id: 6,
    text: '가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것이다.',
    author: '워렌 버핏',
  },
  {
    id: 7,
    text: '시장의 단기적 변동성은 투기꾼의 친구이지만, 투자자의 적이다.',
    author: '벤저민 그레이엄',
  },
  {
    id: 8,
    text: '성공적인 투자의 핵심은 시장을 이기는 것이 아니라 자신을 이기는 것이다.',
    author: '피터 린치',
  },
  {
    id: 9,
    text: '투자는 시간과 인내가 필요한 게임이다.',
    author: '찰리 멍거',
  },
  {
    id: 10,
    text: '위험을 관리하지 않으면 돈을 잃을 수 있다.',
    author: '조지 소로스',
  },
  {
    id: 11,
    text: '시장의 극단적인 상황에서도 침착함을 유지하는 것이 성공의 열쇠다.',
    author: '존 템플턴',
  },
  {
    id: 12,
    text: '투자는 과학이 아니라 예술이다.',
    author: '필립 피셔',
  },
  {
    id: 13,
    text: '가장 위험한 것은 위험을 모르는 것이다.',
    author: '워렌 버핏',
  },
  {
    id: 14,
    text: '시장 타이밍보다는 시장에 머무는 시간이 더 중요하다.',
    author: '피터 린치',
  },
  {
    id: 15,
    text: '성공적인 투자는 감정이 아닌 이성에 기반해야 한다.',
    author: '벤저민 그레이엄',
  },
]

export async function GET() {
  try {
    // 랜덤하게 명언 선택
    const randomIndex = Math.floor(Math.random() * QUOTES.length)
    const quote = QUOTES[randomIndex]

    return NextResponse.json({
      success: true,
      data: quote,
      message: '명언을 성공적으로 가져왔습니다.',
    })
  } catch (error) {
    console.error('Quotes API Error:', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: '명언을 가져오는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

