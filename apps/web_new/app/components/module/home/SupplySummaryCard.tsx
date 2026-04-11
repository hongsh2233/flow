"use client";

import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { formatSupplySignedMillion } from "@/lib/utils/formatSupplyAmount";
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

function formatLabel(n: number): string {
  if (n === 0) return "0원";
  const formatted = formatSupplySignedMillion(n);
  if (n > 0) return `순매수 ${formatted}`;
  return `순매도 ${formatted}`;
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
          차익 {formatSupplySignedMillion(slice.programArbitrage)}
        </span>
        <span className={styles.sep}>·</span>
        <span className={slice.programNonArbitrage >= 0 ? styles.up : styles.down}>
          비차익 {formatSupplySignedMillion(slice.programNonArbitrage)}
        </span>
      </div>
    </div>
  );
}

function MarketSection({ title, slice }: { title: string; slice: MarketSlice }) {
  return (
    <div className={styles.marketBlock}>
      <h3 className={styles.marketTitle}>{title}</h3>
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

  // market=all 또는 kospi 중 있는 요약을 코스피 위에 한 번만 표시
  const sharedSummary = data.kospi.aiSummary || data.kosdaq.aiSummary;

  const cardContent = (
    <>
      <h2 className={styles.title}>{data.timeLabel}</h2>
      {sharedSummary ? <p className={styles.excerpt}>{sharedSummary}</p> : null}
      <MarketSection title="코스피" slice={data.kospi} />
      <MarketSection title="코스닥" slice={data.kosdaq} />
      <p className={styles.unitHint} role="note">
        금액 뒤 단위: <strong>조원</strong>·<strong>억원</strong>·<strong>백만원</strong> (네이버 수급 합산 기준 백만 원).
      </p>
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
