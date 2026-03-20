"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import styles from "./SupplySummaryCard.module.css";

function parseNum(val: string): number {
  const s = String(val).replace(/,/g, "").replace(/\+/g, "").trim();
  if (!s || s === "-") return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
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
  return "보합";
}

interface SupplyData {
  foreign: number;
  individual: number;
  institution: number;
  programArbitrage: number;
  programNonArbitrage: number;
  timeLabel: string;
}

type MarketKey = "kospi" | "kosdaq";

interface MarketState {
  data: SupplyData | null;
  loading: boolean;
  error: boolean;
}

interface SupplySummaryCardProps {
  /** true면 Link 대신 div로 렌더 (supply 페이지 등) */
  standalone?: boolean;
}

function generateSummary(data: SupplyData): string {
  const f = formatLabel(data.foreign);
  const i = formatLabel(data.individual);
  const inst = formatLabel(data.institution);
  const arb = formatSigned(data.programArbitrage);
  const nonArb = formatSigned(data.programNonArbitrage);
  return `외국인이 ${f}하고, 개인은 ${i}, 기관은 ${inst}하였습니다. 프로그램 차익 ${arb}, 비차익 ${nonArb}.`;
}

function NumbersBlock({ data }: { data: SupplyData }) {
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

function MarketSection({ market, state }: { market: MarketKey; state: MarketState }) {
  const marketLabel = market === "kospi" ? "코스피" : "코스닥";
  const badgeClass = market === "kospi" ? styles.badgeKospi : styles.badgeKosdaq;

  return (
    <div className={styles.marketSection}>
      <div className={styles.marketSectionHeader}>
        <span className={badgeClass}>{marketLabel}</span>
        {state.data && (
          <span className={styles.timeLabel}>{state.data.timeLabel}</span>
        )}
      </div>
      {state.loading ? (
        <p className={styles.excerpt}>수급 데이터 불러오는 중...</p>
      ) : state.error || !state.data ? (
        <p className={styles.excerpt}>{marketLabel} 수급 데이터가 없습니다.</p>
      ) : (
        <>
          <p className={styles.excerpt}>{generateSummary(state.data)}</p>
          <NumbersBlock data={state.data} />
        </>
      )}
    </div>
  );
}

export function SupplySummaryCard({ standalone = false }: SupplySummaryCardProps) {
  const [markets, setMarkets] = useState<Record<MarketKey, MarketState>>({
    kospi:  { data: null, loading: true, error: false },
    kosdaq: { data: null, loading: true, error: false },
  });

  useEffect(() => {
    const MARKETS: MarketKey[] = ["kospi", "kosdaq"];

    const fetchMarket = async (market: MarketKey) => {
      const fetchWithFallback = async (dataType: string) => {
        const res = await fetch(
          `/api/naver-supply?data_type=${dataType}&market=${market}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json.success && json.data?.rows?.length) return json;
        const fallback = await fetch(
          `/api/naver-supply?data_type=${dataType}&market=all`,
          { cache: "no-store" }
        );
        return fallback.json();
      };

      try {
        const [invJson, progJson] = await Promise.all([
          fetchWithFallback("investor_day"),
          fetchWithFallback("program_day"),
        ]);

        const invRows = invJson?.data?.rows;
        if (!invRows?.length) {
          console.warn(`[SupplySummaryCard] ${market} investor_day 데이터 없음 (fallback 포함)`);
          setMarkets(prev => ({ ...prev, [market]: { data: null, loading: false, error: true } }));
          return;
        }

        const invRow = invRows[0];
        const individual = parseNum(invRow[1] ?? "0");
        const foreign    = parseNum(invRow[2] ?? "0");
        const institution = parseNum(invRow[3] ?? "0");

        let programArbitrage = 0;
        let programNonArbitrage = 0;
        const progRows = progJson?.data?.rows;
        if (progRows?.length) {
          programArbitrage    = parseNum(progRows[0][3] ?? "0");
          programNonArbitrage = parseNum(progRows[0][6] ?? "0");
        }

        const collectedTime = invJson.collected_time ?? "";
        const marketLabel   = market === "kospi" ? "코스피" : "코스닥";
        const hhmm = collectedTime ? parseInt(collectedTime.replace(":", ""), 10) : 0;
        const timeLabel =
          hhmm >= 1530
            ? `${marketLabel} 장 마감 수급`
            : collectedTime
            ? `${marketLabel} 장중 수급 (${collectedTime} 기준)`
            : `${marketLabel} 수급`;

        setMarkets(prev => ({
          ...prev,
          [market]: {
            data: { foreign, individual, institution, programArbitrage, programNonArbitrage, timeLabel },
            loading: false,
            error: false,
          },
        }));
      } catch (err) {
        console.error(`[SupplySummaryCard] ${market} API 실패:`, err);
        setMarkets(prev => ({ ...prev, [market]: { data: null, loading: false, error: true } }));
      }
    };

    MARKETS.forEach(m => fetchMarket(m));
  }, []);

  const cardContent = (
    <>
      <MarketSection market="kospi"  state={markets.kospi}  />
      <div className={styles.marketDivider} />
      <MarketSection market="kosdaq" state={markets.kosdaq} />
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
      {standalone ? (
        <div className={styles.card}>{cardContent}</div>
      ) : (
        <Link href="/supply" className={styles.card}>
          {cardContent}
        </Link>
      )}
    </section>
  );
}
