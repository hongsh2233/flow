/**
 * 종목 코드 → 종목명 매핑 (관심뉴스 검색용)
 * web/lib/data/stocks.ts 기반, 없는 카테고리는 주석 처리
 */
import {
  marketCapStocks,
  risingStocks,
  favoriteStocksPage,
} from './stocks'

const codeToName: Record<string, string> = {}

function addStocks(
  list: Array<{ name: string; code: string }>
) {
  list.forEach((s) => {
    if (!codeToName[s.code]) {
      codeToName[s.code] = s.name
    }
  })
}

addStocks(marketCapStocks)
addStocks(risingStocks)
addStocks(favoriteStocksPage)

/** 종목 코드로 종목명 조회 (없으면 undefined) */
export function getStockName(code: string): string | undefined {
  return codeToName[code]
}
