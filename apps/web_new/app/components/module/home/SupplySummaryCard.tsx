"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import styles from "./SupplySummaryCard.module.css";

interface SupplySummary {
  success: boolean;
  mode: "intraday" | "closing";
  timeLabel: string;
  bizdate: string | null;
  collectedTime: string | null;
  foreign: number;
  individual: number;
  institution: number;
  programArbitrage: number;
  programNonArbitrage: number;
  aiSummary: string | null;
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

function formatLabel(n: number, type: "foreign" | "individual" | "institution"): string {
  const formatted = formatSigned(n);
  if (n > 0) return `순매수 ${formatted}`;
  if (n < 0) return `순매도 ${formatted}`;
  return "0";
}

export function SupplySummaryCard() {
  const [data, setData] = useState<SupplySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/supply-summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.success !== false) {
          setData(json);
        } else {
          setData(null);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <Link href="/supply" className={styles.card}>
      <div className={styles.header}>
        <BarChart3 className={styles.icon} aria-hidden />
        <span className={styles.timeLabel}>{data.timeLabel}</span>
      </div>
      <div className={styles.body}>
        {data.aiSummary ? (
          <p className={styles.aiSummary}>{data.aiSummary}</p>
        ) : (
          <>
            <div className={styles.investorRow}>
              <span className={data.foreign >= 0 ? styles.up : styles.down}>
                외국인 {formatLabel(data.foreign, "foreign")}
              </span>
              <span className={styles.sep}>·</span>
              <span className={data.individual >= 0 ? styles.up : styles.down}>
                개인 {formatLabel(data.individual, "individual")}
              </span>
              <span className={styles.sep}>·</span>
              <span className={data.institution >= 0 ? styles.up : styles.down}>
                기관 {formatLabel(data.institution, "institution")}
              </span>
            </div>
            <div className={styles.programRow}>
              <span>프로그램매매</span>
              <span className={data.programArbitrage >= 0 ? styles.up : styles.down}>
                차익 {formatSigned(data.programArbitrage)}
              </span>
              <span className={styles.sep}>·</span>
              <span className={data.programNonArbitrage >= 0 ? styles.up : styles.down}>
                비차익 {formatSigned(data.programNonArbitrage)}
              </span>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
