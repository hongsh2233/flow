export interface RisingStock {
  rank: number;
  name: string;
  code: string;
  price: number;
  change: number | string;
}

export interface StockCardProps {
  stocks: RisingStock[];
  onSelect: (stock: RisingStock) => void;
}

export interface StockDetail {
  name: string;
  code: string;
  price: number;
  change: number;
  volume?: string;
  marketCap?: string;
}

export interface StockDetailModalProps {
  stock: StockDetail | null;
  onClose: () => void;
  onAddFavorite?: (stock: StockDetail) => void;
  onRemoveFavorite?: (stock: StockDetail) => void;
  isFavorited?: boolean;
}

export interface SectorData {
  name: string;
  change: number;
  value: number;
}

export interface MarketCapStock {
  rank: number;
  name: string;
  code: string;
  price: number;
  change: number;
  /** 시총상위 탭에서만 표시. 등락률상위 등에서는 생략 가능 */
  marketCap?: string;
}

export interface FavoriteStock {
  id: string;
  name: string;
  code: string;
  price: number;
  change: number;
}
