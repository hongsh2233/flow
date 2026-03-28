"use client";

import type { StockDetail } from "@/lib/types";
import { AiScreeningSection } from "./AiScreeningSection";
import { BrokerConnectButton } from "./BrokerConnectButton";
import { PicksDisclaimerBanner } from "./PicksDisclaimerBanner";
import styles from "./Picks.module.css";

type Props = {
  onSelectStock?: (s: StockDetail) => void;
  onAddFavorite?: (s: StockDetail) => void;
  favCodes?: Set<string>;
};

/** 마켓 허브 상단: 고지 → 증권사 → AI 스크리닝 */
export function MarketPicksSection({ onSelectStock, onAddFavorite, favCodes }: Props) {
  return (
    <div id="market-picks" className={styles.wrap}>
      <PicksDisclaimerBanner />
      <BrokerConnectButton />
      <AiScreeningSection
        onSelectStock={onSelectStock}
        onAddFavorite={onAddFavorite}
        favCodes={favCodes}
      />
    </div>
  );
}
