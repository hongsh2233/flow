import type { StockDetail } from "./stock";

/* ── 실시간 검색 ── */
export interface RealtimeSearchItem {
  rank: number;
  name: string;
  change: number;
}

/* ── 거래량 상위 종목 ── */
export interface VolumeStock {
  rank: number;
  name: string;
  code: string;
  price: number;
  change: number;
  volume: string;
}

/* ── 거래대금 상위 종목 ── */
export interface ValueStock {
  rank: number;
  name: string;
  price: number;
  change: number;
  value: string;
}

/* ── 상승종목 (네이버증권 10%이상) ── */
export interface RisingStock {
  rank: number;
  stock_code: string;
  stock_name: string;
  current_price: string;
  change_percent: string;
  volume: string;
}

/* ── 관심종목 ── */
export interface FavoriteStockItem {
  id: string;
  name: string;
  code: string;
  price: number;
  change: number;
}

/* ── 환율 ── */
export interface ExchangeRateItem {
  currency: string;
  rate: string;
  change: string;
  isPositive: boolean;
}

export interface InterestRateItem {
  name: string;
  rate: string;
  change: string;
  isPositive: boolean;
}

/* ── 지수 ── */
export interface MarketIndexItem {
  name: string;
  value: string;
  change: string;
  isPositive: boolean;
  /** 0% 등락 시 그레이 보더 적용 */
  isNeutral?: boolean;
}

/* ── 컴포넌트 Props ── */
export interface FavoriteStocksProps {
  stocks: FavoriteStockItem[];
  onSelect: (stock: StockDetail) => void;
}

export interface RealtimeSearchProps {
  items: RealtimeSearchItem[];
  baseTimestamp?: string | null;
}

export interface TradeRankingProps {
  kospiVolume: VolumeStock[];
  kosdaqVolume: VolumeStock[];
  kospiValue: ValueStock[];
  kosdaqValue: ValueStock[];
  risingKospi: RisingStock[];
  risingKosdaq: RisingStock[];
  risingCollectedTime?: string | null;
  onSelect: (stock: StockDetail) => void;
  baseTimestamp?: string | null;
}

export interface ExchangeRatesProps {
  rates: ExchangeRateItem[];
  interestRates?: InterestRateItem[];
  baseTimestamp?: string | null;
}

export interface MarketIndexProps {
  indices: MarketIndexItem[];
  /** 최종 수집일자 (예: "2025-03-13 15:30") */
  collectedDate?: string | null;
}
