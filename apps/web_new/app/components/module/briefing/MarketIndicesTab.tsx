"use client";

import { useState, useEffect } from "react";
import { BarChart3, Building2 } from "lucide-react";
import styles from "./MarketIndicesTab.module.css";

interface SectorItem {
  name: string;
  value: number;
  change: number;
}

export function MarketIndicesTab() {
  const [kospiSectors, setKospiSectors] = useState<SectorItem[]>([]);
  const [kosdaqSectors, setKosdaqSectors] = useState<SectorItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [krxKospi, krxKosdaq, domestic] = await Promise.all([
          fetch("/api/krx-data?data_type=kospi"),
          fetch("/api/krx-data?data_type=kosdaq"),
          fetch("/api/domestic-indices"),
        ]);
        const krxKospiJson = await krxKospi.json();
        const krxKosdaqJson = await krxKosdaq.json();
        const domesticJson = await domestic.json();

        const mapKrxToSectors = (arr: unknown[]): SectorItem[] => {
          if (!Array.isArray(arr) || arr.length === 0) return [];
          return arr.map((it) => {
            const rec = it as Record<string, unknown>;
            const name = String(rec.IDX_NM ?? rec.idx_nm ?? "");
            const val = parseFloat(String(rec.CLSPRC_IDX ?? rec.clsprc_idx ?? rec.CLPR ?? rec.clpr ?? 0).replace(/,/g, "")) || 0;
            const chg = parseFloat(String(rec.FLUC_RT ?? rec.fluc_rt ?? rec.FLT_RT ?? rec.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0;
            return { name: name || "지수", value: val, change: chg };
          }).filter((s) => s.name);
        };

        const extractFirstData = (json: { data?: Array<{ data?: unknown }> }): unknown[] => {
          const list = json.data ?? [];
          const rec = list.find((r) => r.data);
          const d = rec?.data;
          return Array.isArray(d) ? d : [];
        };

        let kospiItems = mapKrxToSectors(extractFirstData(krxKospiJson));
        let kosdaqItems = mapKrxToSectors(extractFirstData(krxKosdaqJson));

        if (kospiItems.length === 0 || kosdaqItems.length === 0) {
          const data = domesticJson.data ?? [];
          const kospi = data.find((d: { name: string }) => d.name === "코스피");
          const kosdaq = data.find((d: { name: string }) => d.name === "코스닥");
          if (kospiItems.length === 0 && kospi) {
            kospiItems = [{ name: kospi.name, value: parseFloat(String(kospi.value).replace(/,/g, "")) || 0, change: parseFloat(String(kospi.percent || kospi.change).replace(/[%,+]/g, "")) || 0 }];
          }
          if (kosdaqItems.length === 0 && kosdaq) {
            kosdaqItems = [{ name: kosdaq.name, value: parseFloat(String(kosdaq.value).replace(/,/g, "")) || 0, change: parseFloat(String(kosdaq.percent || kosdaq.change).replace(/[%,+]/g, "")) || 0 }];
          }
        }

        setKospiSectors(kospiItems);
        setKosdaqSectors(kosdaqItems);
      } catch {
        setKospiSectors([]);
        setKosdaqSectors([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading && kospiSectors.length === 0 && kosdaqSectors.length === 0) {
    return <p className={styles.loading}>로딩 중...</p>;
  }

  return (
    <>
      <div className={styles.sectorSection}>
        <h3 className={styles.sectorTitle}>
          <BarChart3 className={styles.sectorIconBlue} aria-hidden />
          코스피
        </h3>
        <div className={styles.sectorList}>
          {kospiSectors.length === 0 ? (
            <p className={styles.loading}>데이터가 없습니다.</p>
          ) : (
            kospiSectors.map((sector) => {
              const isPositive = sector.change >= 0;
              return (
                <div key={sector.name} className={styles.sectorCard}>
                  <div>
                    <p>{sector.name}</p>
                    <p>{sector.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <p className={`${styles.sectorChange} ${isPositive ? styles.sectorChangeUp : styles.sectorChangeDown}`}>
                    {isPositive ? "+" : ""}
                    {sector.change.toFixed(2)}%
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className={styles.sectorSection}>
        <h3 className={styles.sectorTitle}>
          <Building2 className={styles.sectorIconPurple} aria-hidden />
          코스닥
        </h3>
        <div className={styles.sectorList}>
          {kosdaqSectors.length === 0 ? (
            <p className={styles.loading}>데이터가 없습니다.</p>
          ) : (
            kosdaqSectors.map((sector) => {
              const isPositive = sector.change >= 0;
              return (
                <div key={sector.name} className={styles.sectorCard}>
                  <div>
                    <p>{sector.name}</p>
                    <p>{sector.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <p className={`${styles.sectorChange} ${isPositive ? styles.sectorChangeUp : styles.sectorChangeDown}`}>
                    {isPositive ? "+" : ""}
                    {sector.change.toFixed(2)}%
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
