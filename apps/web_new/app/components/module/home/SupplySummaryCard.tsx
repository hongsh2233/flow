"use client";

import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import styles from "./SupplySummaryCard.module.css";

interface MarketSlice {
  foreign: number;
  individual: number;
  institution: number;
  programArbitrage: number;
  programNonArbitrage: number;
  aiSummary: string | null;
}

interface SupplySummary {
  success: boolean;
  mode: "intraday" | "closing";
  timeLabel: string;
  bizdate: string | null;
  collectedTime: string | null;
  kospi: MarketSlice;
  kosdaq: MarketSlice;
}

function formatNumber(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  return n.toLocaleString();
}

function formatSigned(n: number): string {
  const s = formatNumber(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatLabel(n: number): string {
  const formatted = formatSigned(n);
  if (n > 0) return `순매수 ${formatted}`;
  if (n < 0) return `순매도 ${formatted}`;
  return "0";
}

function NumbersBlock({ slice }: { slice: MarketSlice }) {
  return (
    <div className={styles.numbersRow}>
      <div className={styles.investorRow}>
        <span className={slice.foreign >= 0 ? styles.up : styles.down}>
          외국인 {formatLabel(slice.foreign)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={slice.individual >= 0 ? styles.up : styles.down}>
          개인 {formatLabel(slice.individual)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={slice.institution >= 0 ? styles.up : styles.down}>
          기관 {formatLabel(slice.institution)}
        </span>
      </div>
      <div className={styles.programRow}>
        <span>프로그램매매 :</span>
        <span className={slice.programArbitrage >= 0 ? styles.up : styles.down}>
          차익 {formatSigned(slice.programArbitrage)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={slice.programNonArbitrage >= 0 ? styles.up : styles.down}>
          비차익 {formatSigned(slice.programNonArbitrage)}
        </span>
      </div>
    </div>
  );
}

function MarketSection({ title, slice }: { title: string; slice: MarketSlice }) {
  return (
    <div className={styles.marketBlock}>
      <h3 className={styles.marketTitle}>{title}</h3>
      {slice.aiSummary ? <p className={styles.excerpt}>{slice.aiSummary}</p> : null}
      <NumbersBlock slice={slice} />
    </div>
  );
}

export function SupplySummaryCard() {
  const [data, setData] = useState<SupplySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/supply-summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.success !== false && json.kospi && json.kosdaq) {
          setData(json);
        } else {
          setData(null);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const cardContent = (
    <>
      <h2 className={styles.title}>{data.timeLabel}</h2>
      <MarketSection title="코스피" slice={data.kospi} />
      <MarketSection title="코스닥" slice={data.kosdaq} />
    </>
  );

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <BarChart3 className={styles.headingIcon} aria-hidden />
          수급 요약
        </h3>
      </div>
      <div className={styles.cardList}>
        <div className={styles.card}>{cardContent}</div>
      </div>
    </section>
  );
}
