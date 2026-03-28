"use client";

import { useCallback, useEffect, useState } from "react";
import type { PicksGradeTier } from "@/lib/picks/gradeTier";
import type { StockDetail } from "@/lib/types";
import { ScreeningResultTable, type ScreeningRow } from "./ScreeningResultTable";
import styles from "./Picks.module.css";

type Props = {
  onSelectStock?: (s: StockDetail) => void;
  onAddFavorite?: (s: StockDetail) => void;
  favCodes?: Set<string>;
};

export function AiScreeningSection({ onSelectStock, onAddFavorite, favCodes }: Props) {
  const [strategy, setStrategy] = useState<"ichimoku" | "jongbe">("ichimoku");
  const [market, setMarket] = useState<"kospi" | "kosdaq">("kospi");
  const [rows, setRows] = useState<ScreeningRow[]>([]);
  const [tier, setTier] = useState<PicksGradeTier>("guest");
  const [screeningDate, setScreeningDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const st = strategy === "jongbe" ? "jongbe" : "ichimoku";
      const res = await fetch(
        `/api/picks/ai-screening?market_type=${market}&screening_type=${st}&limit=50`,
        { cache: "no-store", credentials: "same-origin" }
      );
      const json = await res.json();
      setRows(Array.isArray(json.data) ? json.data : []);
      setScreeningDate(json.screening_date ?? null);
      if (json.tier === "family" || json.tier === "member_limited" || json.tier === "guest") {
        setTier(json.tier);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [strategy, market]);

  useEffect(() => {
    load();
  }, [load]);

  const titleDate = screeningDate ?? "—";

  return (
    <section aria-labelledby="ai-screening-heading">
      <h2 id="ai-screening-heading" className={styles.sectionTitle}>
        {titleDate} 관심 종목
      </h2>
      <div className={styles.tabsRow}>
        <button
          type="button"
          className={strategy === "ichimoku" ? styles.tabActive : styles.tab}
          onClick={() => setStrategy("ichimoku")}
        >
          일목균형표
        </button>
        <button
          type="button"
          className={strategy === "jongbe" ? styles.tabActive : styles.tab}
          onClick={() => setStrategy("jongbe")}
        >
          종가베팅
        </button>
      </div>
      <div className={styles.tabsRow}>
        <button
          type="button"
          className={market === "kospi" ? styles.tabActive : styles.tab}
          onClick={() => setMarket("kospi")}
        >
          코스피
        </button>
        <button
          type="button"
          className={market === "kosdaq" ? styles.tabActive : styles.tab}
          onClick={() => setMarket("kosdaq")}
        >
          코스닥
        </button>
      </div>
      {loading ? (
        <p className={styles.meta}>불러오는 중...</p>
      ) : (
        <ScreeningResultTable
          rows={rows}
          tier={tier}
          onSelectStock={onSelectStock}
          onAddFavorite={onAddFavorite}
          favCodes={favCodes}
        />
      )}
    </section>
  );
}
