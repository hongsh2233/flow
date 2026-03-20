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
  return "0";
}

interface SupplyData {
  foreign: number;
  individual: number;
  institution: number;
  programArbitrage: number;
  programNonArbitrage: number;
  timeLabel: string;
}

interface SupplySummaryCardProps {
  /** true면 Link 대신 div로 렌더 (supply 페이지 등) */
  standalone?: boolean;
  /** 시장 구분 (기본값: kospi) */
  market?: "kospi" | "kosdaq";
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

export function SupplySummaryCard({ standalone = false, market = "kospi" }: SupplySummaryCardProps) {
  const [data, setData] = useState<SupplyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    // 기존에 동작하는 /api/naver-supply 라우트를 직접 호출 (supply 페이지와 동일)
    const fetchInvestor = fetch(
      `/api/naver-supply?data_type=investor_day&market=${market}`,
      { cache: "no-store" }
    ).then((r) => r.json());

    const fetchProgram = fetch(
      `/api/naver-supply?data_type=program_day&market=${market}`,
      { cache: "no-store" }
    ).then((r) => r.json());

    Promise.all([fetchInvestor, fetchProgram])
      .then(([invJson, progJson]) => {
        // investor_day 파싱: 열 순서 = 날짜(0), 개인(1), 외국인(2), 기관계(3)
        const invRows = invJson?.data?.rows;
        if (!invRows || invRows.length === 0) {
          console.warn(`[SupplySummaryCard] ${market} investor_day 데이터 없음`);
          setError(true);
          return;
        }
        const invRow = invRows[0];
        const individual = parseNum(invRow[1] ?? "0");
        const foreign = parseNum(invRow[2] ?? "0");
        const institution = parseNum(invRow[3] ?? "0");

        // program_day 파싱: 열 순서 = 날짜(0), 차익매수(1), 차익매도(2), 차익순매수(3),
        //                              비차익매수(4), 비차익매도(5), 비차익순매수(6)
        let programArbitrage = 0;
        let programNonArbitrage = 0;
        const progRows = progJson?.data?.rows;
        if (progRows && progRows.length > 0) {
          const progRow = progRows[0];
          programArbitrage = parseNum(progRow[3] ?? "0");
          programNonArbitrage = parseNum(progRow[6] ?? "0");
        }

        // 시간 라벨
        const collectedTime = invJson.collected_time ?? "";
        const marketLabel = market === "kospi" ? "코스피" : "코스닥";
        const hhmm = collectedTime ? parseInt(collectedTime.replace(":", ""), 10) : 0;
        const timeLabel =
          hhmm >= 1530
            ? `${marketLabel} 장 마감 수급`
            : collectedTime
            ? `${marketLabel} 장중 수급 (${collectedTime} 기준)`
            : `${marketLabel} 수급`;

        setData({ foreign, individual, institution, programArbitrage, programNonArbitrage, timeLabel });
        setError(false);
      })
      .catch((err) => {
        console.error(`[SupplySummaryCard] ${market} API 실패:`, err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [market]);

  const marketLabel = market === "kospi" ? "코스피" : "코스닥";

  const renderCard = () => {
    if (loading) {
      return (
        <div className={styles.card}>
          <p style={{ textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.8125rem", margin: 0 }}>
            수급 데이터 불러오는 중...
          </p>
        </div>
      );
    }

    if (error || !data) {
      return (
        <div className={styles.card}>
          <p style={{ textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.8125rem", margin: 0 }}>
            {marketLabel} 수급 데이터가 없습니다.
          </p>
        </div>
      );
    }

    const content = (
      <>
        <h2 className={styles.title}>{data.timeLabel}</h2>
        <NumbersBlock data={data} />
      </>
    );

    if (standalone) {
      return <div className={styles.card}>{content}</div>;
    }
    return (
      <Link href="/supply" className={styles.card}>
        {content}
      </Link>
    );
  };

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
        {renderCard()}
      </div>
    </section>
  );
}
