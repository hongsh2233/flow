"use client";

import { useEffect, useState } from "react";
import styles from "./SentimentIndexCard.module.css";

interface SentimentLatest {
  composite_score: number;
  label: string;
  snapshot_date: string;
  snapshot_time: string;
}

interface SentimentHistory {
  snapshot_date: string;
  composite_score: number;
}

/** 점수 → 게이지 색상 */
function scoreColor(score: number): string {
  if (score <= 25) return "#dc2626";
  if (score <= 44) return "#ea580c";
  if (score <= 55) return "#ca8a04";
  if (score <= 75) return "#65a30d";
  return "#16a34a";
}

/** 반원 게이지 SVG (0~100) */
function GaugeArc({ score }: { score: number }) {
  const cx = 60,
    cy = 55,
    r = 45;
  const startAngle = Math.PI;
  const endAngle = Math.PI + (Math.PI * Math.min(Math.max(score, 0), 100)) / 100;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = score > 50 ? 1 : 0;
  const color = scoreColor(score);

  return (
    <svg viewBox="0 0 120 65" className={styles.gaugeSvg} width={120} height={65}>
      {/* 배경 호 */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="var(--app-table-border, #e5e8eb)"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* 점수 호 */}
      {score > 0 && (
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/** 미니 라인 차트 SVG */
function MiniChart({ data }: { data: SentimentHistory[] }) {
  if (data.length < 2) return null;

  const sorted = [...data].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const scores = sorted.map((d) => d.composite_score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const w = 200,
    h = 50,
    px = 8,
    py = 6;
  const stepX = (w - px * 2) / (scores.length - 1);

  const points = scores
    .map((s, i) => {
      const x = px + i * stepX;
      const y = h - py - ((s - min) / range) * (h - py * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastScore = scores[scores.length - 1];
  const color = scoreColor(lastScore);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={styles.chartSvg} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* 마지막 점 */}
      {(() => {
        const lastX = px + (scores.length - 1) * stepX;
        const lastY = h - py - ((lastScore - min) / range) * (h - py * 2);
        return <circle cx={lastX} cy={lastY} r={3} fill={color} />;
      })()}
    </svg>
  );
}

export function SentimentIndexCard() {
  const [latest, setLatest] = useState<SentimentLatest | null>(null);
  const [history, setHistory] = useState<SentimentHistory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/sentiment/latest", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/sentiment/history?days=7", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([latestRes, historyRes]) => {
        if (cancelled) return;
        if (latestRes?.success && latestRes.data) {
          setLatest(latestRes.data);
        }
        if (historyRes?.success && Array.isArray(historyRes.data)) {
          setHistory(historyRes.data);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !latest) return null;

  return (
    <section className={styles.card} aria-label="투자자 심리지수">
      <div className={styles.header}>
        <h2 className={styles.title}>투자자 심리지수</h2>
        <span className={styles.updatedAt}>
          {latest.snapshot_date} {latest.snapshot_time}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.gaugeWrap}>
          <GaugeArc score={latest.composite_score} />
          <span className={styles.gaugeScore}>{latest.composite_score}</span>
          <span className={`${styles.gaugeLabel} ${styles[`label--${latest.label}`]}`}>
            {latest.label}
          </span>
        </div>
        <div className={styles.chartWrap}>
          {history.length >= 2 ? (
            <>
              <MiniChart data={history} />
              <span className={styles.chartHint}>최근 7일 추이</span>
            </>
          ) : (
            <span className={styles.chartHint}>추이 데이터 수집 중</span>
          )}
        </div>
      </div>
    </section>
  );
}
