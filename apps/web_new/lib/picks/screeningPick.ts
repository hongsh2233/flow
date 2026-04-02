import type { StockDetail } from "@/lib/types";

/** 스크리닝 표 담기 시 포인트 차감 API에 넘기는 메타 */
export type ScreeningPickMeta = {
  rank: number;
  screeningDate: string | null;
  screeningType: "ichimoku" | "jongbe";
};

export type PickStockHandler = (stock: StockDetail, meta: ScreeningPickMeta) => void | Promise<void>;
