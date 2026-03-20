"use client";

import { useState, useEffect } from "react";
import styles from "./SupplySummaryCard.module.css";

interface InvestorRow {
  individual: number;
  foreign: number;
  institution: number;
  other: number;
}

interface MarketSummary {
  data: InvestorRow | null;
  timestamp: string | null;
  loading: boolean;
}

function formatAmount(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100000) return `${(val / 100000).toFixed(1)}조`;
  if (abs >= 1000) return `${(val / 1000).toFixed(0)}억`;
  return `${val.toLocaleString()}백만`;
}

function AmountCell({ value }: { value: number }) {
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span className={isPos ? styles.up : isNeg ? styles.down : styles.neutral}>
      {value > 0 ? "+" : ""}{formatAmount(value)}
    </span>
  );
}

const ROWS: { key: keyof InvestorRow; label: string }[] = [
  { key: "foreign", label: "외국인" },
  { key: "institution", label: "기관" },
  { key: "individual", label: "개인" },
  { key: "other", label: "기타법인" },
];

function MarketBlock({
  label,
  summary,
}: {
  label: string;
  summary: MarketSummary;
}) {
  return (
    <div className={styles.marketBlock}>
      <div className={styles.marketHeader}>
        <span className={styles.marketLabel}>{label}</span>
        {summary.timestamp && (
          <span className={styles.timestamp}>{summary.timestamp} 기준</span>
        )}
      </div>
      {summary.loading ? (
        <p className={styles.loading}>불러오는 중...</p>
      ) : !summary.data ? (
        <p className={styles.empty}>데이터 없음</p>
      ) : (
        <div className={styles.grid}>
          {ROWS.map(({ key, label: rowLabel }) => (
            <div key={key} className={styles.row}>
              <span className={styles.rowLabel}>{rowLabel}</span>
              <AmountCell value={summary.data![key]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SupplySummaryCard() {
  const [kospi, setKospi] = useState<MarketSummary>({ data: null, timestamp: null, loading: true });
  const [kosdaq, setKosdaq] = useState<MarketSummary>({ data: null, timestamp: null, loading: true });

  useEffect(() => {
    async function fetchMarket(market: "kospi" | "kosdaq") {
      const setState = market === "kospi" ? setKospi : setKosdaq;
      try {
        const res = await fetch(
          `/api/naver-investor-trend?market=${market}&data_type=investor_day&limit=1`
        );
        const json = await res.json();
        const latest = json.success && Array.isArray(json.data) && json.data.length > 0
          ? json.data[json.data.length - 1]
          : null;
        setState({
          data: latest
            ? {
                individual: latest.individual ?? 0,
                foreign: latest.foreign ?? 0,
                institution: latest.institution ?? 0,
                other: latest.other ?? 0,
              }
            : null,
          timestamp: json.timestamp ?? null,
          loading: false,
        });
      } catch {
        setState({ data: null, timestamp: null, loading: false });
      }
    }

    fetchMarket("kospi");
    fetchMarket("kosdaq");
  }, []);

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>수급 요약</h3>
      <p className={styles.unit}>단위: 백만원 (순매수 기준)</p>
      <MarketBlock label="코스피" summary={kospi} />
      <div className={styles.divider} />
      <MarketBlock label="코스닥" summary={kosdaq} />
    </div>
  );
}
