export type JuBTI = "Bull" | "Bear" | "Whale" | "Rabbit" | "Fox" | "Turtle";

export interface GuestbookMessage {
  id: number;
  user: string;
  jubti: JuBTI;
  content: string;
  time: string;
  likes: number;
  isLiked?: boolean;
}

export interface Expert {
  id: number;
  name: string;
  title: string;
  image: string;
  quote: string;
  likes: number;
  is_liked?: boolean;
}

export interface MarketVoice {
  id: number;
  name: string;
  title: string;
  image: string;
  statement: string;
  time: string;
  source: string;
  sourceUrl: string;
}

export interface StockTermItem {
  id: number;
  name: string;
  title?: string | null;
  quote: string;
  image_url?: string | null;
}

export interface BoardSummary {
  id: string;
  name: string;
  type: string;
}

export interface BoardPostFromApi {
  id: number;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

export interface VoteOption {
  id: number;
  label: string;
  count: number;
}

