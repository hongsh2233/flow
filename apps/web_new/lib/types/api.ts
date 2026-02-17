/**
 * API 타입 정의
 * ApiResponse는 board.ts에서 export
 */

/**
 * FSC 주가 데이터 타입 (BO fsc-stock-price 응답)
 */
export interface FscStockPrice {
  srtn_cd?: string;
  itms_nm?: string;
  clpr?: string;
  vs?: string;
  flt_rt?: string;
  bas_dt?: string;
  [key: string]: unknown;
}

/**
 * 관심종목 응답 타입
 */
export interface FavoriteStockResponse {
  success: boolean;
  message?: string;
  favorite_stocks: string[];
}
