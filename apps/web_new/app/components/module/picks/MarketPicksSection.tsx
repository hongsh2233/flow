"use client";

import type { StockDetail } from "@/lib/types";
import { AiScreeningSection } from "./AiScreeningSection";
import { AuthorPickSection } from "./AuthorPickSection";
import { BrokerConnectButton } from "./BrokerConnectButton";
import { PicksDisclaimerBanner } from "./PicksDisclaimerBanner";
import styles from "./Picks.module.css";

type Props = {
  onSelectStock?: (s: StockDetail) => void;
};

/** 마켓 허브 상단: 고지 → 증권사 → AI 스크리닝 → 작가 픽 */
export function MarketPicksSection({ onSelectStock }: Props) {
  return (
    <div id="market-picks" className={styles.wrap}>
      <PicksDisclaimerBanner />
      <BrokerConnectButton />
      <AiScreeningSection onSelectStock={onSelectStock} />
      <AuthorPickSection onSelectStock={onSelectStock} />
    </div>
  );
}
