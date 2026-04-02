"use client";

import type { StockDetail } from "@/lib/types";
import { AiScreeningSection } from "./AiScreeningSection";
import { PicksDisclaimerBanner } from "./PicksDisclaimerBanner";
import styles from "./Picks.module.css";

type Props = {
  onSelectStock?: (s: StockDetail) => void;
  /** 추천 표 담기(로컬 내 종목 시세); 관심종목과 별도 */
  onPickStock?: (s: StockDetail) => void;
  pickedCodes?: Set<string>;
};

/** 마켓 허브 상단: 고지 → AI 스크리닝 */
export function MarketPicksSection({ onSelectStock, onPickStock, pickedCodes }: Props) {
  return (
    <div id="market-picks" className={styles.wrap}>
      <PicksDisclaimerBanner />
      <AiScreeningSection
        onSelectStock={onSelectStock}
        onPickStock={onPickStock}
        pickedCodes={pickedCodes}
      />
    </div>
  );
}
