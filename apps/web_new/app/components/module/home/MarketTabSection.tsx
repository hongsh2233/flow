"use client";

import { useState } from "react";
import { MarketIndexSection } from "./MarketIndexSection";
import { ForeignIndices } from "./ForeignIndices";
import { ExchangeRatesSection } from "./ExchangeRatesSection";
import styles from "./MarketTabSection.module.css";

const TABS = ["국내 지수", "해외 지수", "환율&금리"] as const;
type TabLabel = (typeof TABS)[number];

export function MarketTabSection() {
  const [activeTab, setActiveTab] = useState<TabLabel>("국내 지수");

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.title}>주요 지수</h3>
        <div className={styles.tabList} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.content}>
        {activeTab === "국내 지수" && <MarketIndexSection />}
        {activeTab === "해외 지수" && <ForeignIndices />}
        {activeTab === "환율&금리" && <ExchangeRatesSection />}
      </div>
    </div>
  );
}
