"use client";

import { useCallback, useEffect, useState } from "react";
import type { PicksGradeTier } from "@/lib/picks/gradeTier";
import type { StockDetail } from "@/lib/types";
import { DEFAULT_BROKERS } from "@/lib/picks/defaultBrokers";
import { BROKER_STORAGE_KEY, mergeBrokerWithCatalog, openBrokerApp } from "@/lib/picks/openBroker";
import { BrokerSelectSheet, type BrokerItem } from "./BrokerSelectSheet";
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
  const [brokers, setBrokers] = useState<BrokerItem[]>(DEFAULT_BROKERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch("/api/picks/brokers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list = j.brokers;
        if (Array.isArray(list) && list.length > 0) {
          setBrokers(list as BrokerItem[]);
        }
      })
      .catch(() => {
        /* BO 미연결 시 DEFAULT_BROKERS 유지 */
      });
  }, []);

  const handleMtsClick = useCallback(() => {
    try {
      const raw = localStorage.getItem(BROKER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BrokerItem;
        if (parsed?.id) {
          void openBrokerApp(mergeBrokerWithCatalog(parsed, brokers));
          return;
        }
      }
    } catch {
      /* invalid */
    }
    setSheetOpen(true);
  }, [brokers]);

  const handleBrokerSelect = useCallback((b: BrokerItem) => {
    try {
      localStorage.setItem(BROKER_STORAGE_KEY, JSON.stringify(b));
    } catch {
      /* ignore */
    }
    setSheetOpen(false);
    void openBrokerApp(b);
  }, []);

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
      if (
        json.tier === "family" ||
        json.tier === "member" ||
        json.tier === "vip" ||
        json.tier === "guest"
      ) {
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
      <div className={styles.strategyTabsRow} role="tablist" aria-label="추천 유형">
        <button
          type="button"
          role="tab"
          aria-selected={strategy === "ichimoku"}
          className={strategy === "ichimoku" ? styles.strategyTabActive : styles.strategyTab}
          onClick={() => setStrategy("ichimoku")}
        >
          추천종목
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={strategy === "jongbe"}
          className={strategy === "jongbe" ? styles.strategyTabActive : styles.strategyTab}
          onClick={() => setStrategy("jongbe")}
        >
          종가종목
        </button>
      </div>
      <div className={styles.marketTabsRow} role="tablist" aria-label="시장 구분">
        <button
          type="button"
          role="tab"
          aria-selected={market === "kospi"}
          className={market === "kospi" ? styles.marketTabActive : styles.marketTab}
          onClick={() => setMarket("kospi")}
        >
          코스피
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={market === "kosdaq"}
          className={market === "kosdaq" ? styles.marketTabActive : styles.marketTab}
          onClick={() => setMarket("kosdaq")}
        >
          코스닥
        </button>
      </div>
      {strategy === "ichimoku" ? (
        <p className={styles.scheduleNotice}>추천종목은 20:40분 공개됩니다.</p>
      ) : (
        <p className={styles.scheduleNotice}>종가종목은 15:15분 전후 공개 됩니다.</p>
      )}
      {loading ? (
        <p className={styles.meta}>불러오는 중...</p>
      ) : (
        <ScreeningResultTable
          rows={rows}
          tier={tier}
          onSelectStock={onSelectStock}
          onAddFavorite={onAddFavorite}
          favCodes={favCodes}
          onMtsClick={handleMtsClick}
        />
      )}

      <BrokerSelectSheet
        open={sheetOpen}
        brokers={brokers}
        onClose={() => setSheetOpen(false)}
        onSelect={handleBrokerSelect}
      />
    </section>
  );
}
