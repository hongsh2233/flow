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

function formatLabel(n: number): string {
  const formatted = formatSigned(n);
  if (n > 0) return `순매수 ${formatted}`;
  if (n < 0) return `순매도 ${formatted}`;
  return "0";
}

interface SupplySummaryCardProps {
  /** true면 Link 대신 div로 렌더 (supply 페이지 등) */
  standalone?: boolean;
  /** 시장 구분 (기본값: kospi) */
  market?: "kospi" | "kosdaq";
}

function NumbersBlock({ data }: { data: SupplySummary }) {
  return (
    <div className={styles.numbersRow}>
      <div className={styles.investorRow}>
        <span className={data.foreign >= 0 ? styles.up : styles.down}>
          외국인 {formatLabel(data.foreign)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={data.individual >= 0 ? styles.up : styles.down}>
          개인 {formatLabel(data.individual)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={data.institution >= 0 ? styles.up : styles.down}>
          기관 {formatLabel(data.institution)}
        </span>
      </div>
      <div className={styles.programRow}>
        <span>프로그램매매 :</span>
        <span className={data.programArbitrage >= 0 ? styles.up : styles.down}>
          차익 {formatSigned(data.programArbitrage)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={data.programNonArbitrage >= 0 ? styles.up : styles.down}>
          비차익 {formatSigned(data.programNonArbitrage)}
        </span>
      </div>
    </div>
  );
}

export function SupplySummaryCard({ standalone = false, market = "kospi" }: SupplySummaryCardProps = {}) {
  const [data, setData] = useState<SupplySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/supply-summary?market=${market}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.success !== false) {
          setData(json);
          setError(false);
        } else {
          console.warn(`[SupplySummaryCard] ${market} 데이터 없음:`, json.message);
          setData(null);
          setError(true);
        }
      })
      .catch((err) => {
        console.error(`[SupplySummaryCard] ${market} API 호출 실패:`, err);
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [market]);

  const marketLabel = market === "kospi" ? "코스피" : "코스닥";

  const cardInner = loading ? (
    <div className={styles.card}>
      <p style={{ textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.8125rem", margin: 0 }}>
        수급 데이터 불러오는 중...
      </p>
    </div>
  ) : error || !data ? (
    <div className={styles.card}>
      <p style={{ textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.8125rem", margin: 0 }}>
        {marketLabel} 수급 데이터가 없습니다.
      </p>
    </div>
  ) : (
    (() => {
      const content = (
        <>
          <h2 className={styles.title}>{data.timeLabel}</h2>
          {data.aiSummary && (
            <p className={styles.excerpt}>{data.aiSummary}</p>
          )}
          <NumbersBlock data={data} />
        </>
      );
      return standalone ? (
        <div className={styles.card}>{content}</div>
      ) : (
        <Link href="/supply" className={styles.card}>
          {content}
        </Link>
      );
    })()
  );

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <BarChart3 className={styles.headingIcon} aria-hidden />
          수급 요약
        </h3>
        <span className={market === "kospi" ? styles.badgeKospi : styles.badgeKosdaq}>
          {marketLabel}
        </span>
      </div>
      <div className={styles.cardList}>
        {cardInner}
      </div>
    </section>
  );
}
