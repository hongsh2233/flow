/**
 * API 타입 정의
 */

/**
 * API 응답 기본 구조
 */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

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
