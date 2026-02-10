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
  isFavorite?: boolean;
  onToggleFavorite?: (stock: StockDetail) => void;
  onShowChart?: (stock: StockDetail) => void;
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
  marketCap: string;
}

export interface FavoriteStock {
  id: string;
  name: string;
  code: string;
  price: number;
  change: number;
}
