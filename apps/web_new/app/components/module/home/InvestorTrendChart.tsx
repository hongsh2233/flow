"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./InvestorTrendChart.module.css";

interface InvestorTrendItem {
  date: string;
  individual: number;
  foreign: number;
  institution: number;
  other: number;
}

const SERIES = [
  { key: "individual" as const, label: "개인",   color: "#3b82f6" },
  { key: "foreign"    as const, label: "외국인", color: "#f59e0b" },
  { key: "institution"as const, label: "기관계", color: "#10b981" },
  { key: "other"      as const, label: "기타법인",color: "#8b5cf6" },
] as const;

const W = 320;
const H = 140;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

function fmtAmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100000) return `${(v / 100000).toFixed(1)}조`;
  if (abs >= 10000)  return `${(v / 10000).toFixed(0)}억`;
  if (abs >= 1000)   return `${(v / 1000).toFixed(0)}천`;
  return String(v);
}

function fmtDate(d: string): string {
  // "2025.03.03" → "03/03", "20250303" → "03/03"
  const clean = d.replace(/[.\-\/]/g, "");
  if (clean.length === 8) return `${clean.slice(4, 6)}/${clean.slice(6, 8)}`;
  // e.g. "03.03" already short
  return d.replace(/\./g, "/").slice(-5);
}

interface LineChartProps {
  data: InvestorTrendItem[];
}

function LineChart({ data }: LineChartProps) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="var(--app-text-muted)">
          데이터가 부족합니다
        </text>
      </svg>
    );
  }

  // 전체 값 범위 계산
  const allVals = data.flatMap((d) =>
    SERIES.map((s) => d[s.key])
  );
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const range = rawMax - rawMin || 1;
  const pad = range * 0.15;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const xStep = innerW / (data.length - 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  // Y=0 위치 (순매수 기준선)
  const zeroY = toY(0);
  const showZero = zeroY > PAD.top && zeroY < PAD.top + innerH;

  // Y 눈금: 5개
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-label="투자자별 매매동향">
      {/* Y 눈금 */}
      {yTicks.map((v, i) => {
        const y = toY(v);
        return (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y}
              stroke="var(--app-border-light)" strokeWidth="0.5" />
            <text x={PAD.left - 4} y={y + 3.5} textAnchor="end"
              fontSize="8.5" fill="var(--app-text-muted)">
              {fmtAmt(Math.round(v))}
            </text>
          </g>
        );
      })}

      {/* 0선 강조 */}
      {showZero && (
        <line x1={PAD.left} x2={PAD.left + innerW} y1={zeroY} y2={zeroY}
          stroke="var(--app-text-muted)" strokeWidth="0.8" strokeDasharray="3,3" />
      )}

      {/* X 눈금 (날짜) */}
      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={PAD.top + innerH + 14}
          textAnchor="middle" fontSize="8.5" fill="var(--app-text-muted)">
          {fmtDate(d.date)}
        </text>
      ))}

      {/* 라인 + 점 */}
      {SERIES.map((s) => {
        const pts = data.map((d, i) => `${toX(i)},${toY(d[s.key])}`).join(" ");
        return (
          <g key={s.key}>
            <polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d, i) => (
              <circle key={i} cx={toX(i)} cy={toY(d[s.key])} r="2.5"
                fill={s.color} stroke="var(--app-card-bg)" strokeWidth="1" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

interface Props {
  defaultMarket?: "kospi" | "kosdaq";
}

export function InvestorTrendChart({ defaultMarket = "kospi" }: Props) {
  const [market, setMarket] = useState<"kospi" | "kosdaq">(defaultMarket);
  const [data, setData] = useState<InvestorTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(SERIES.map((s) => s.key))
  );

  const fetchData = useCallback(async (m: "kospi" | "kosdaq") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/naver-investor-trend?market=${m}`);
      const json = await res.json();
      setData(json.success && json.data?.length ? json.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(market);
  }, [market, fetchData]);

  const toggleSeries = (key: string) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // 최소 1개 유지
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredData: InvestorTrendItem[] = data.map((d) => {
    const copy = { ...d };
    SERIES.forEach((s) => {
      if (!visibleSeries.has(s.key)) copy[s.key] = 0;
    });
    return copy;
  });

  return (
    <div className={styles.wrapper}>
      {/* 헤더: 제목 + 마켓 토글 */}
      <div className={styles.header}>
        <span className={styles.title}>투자자별 매매동향</span>
        <div className={styles.marketToggle}>
          <button
            className={`${styles.mBtn} ${market === "kospi" ? styles.mBtnActive : ""}`}
            onClick={() => setMarket("kospi")}
          >
            코스피
          </button>
          <button
            className={`${styles.mBtn} ${market === "kosdaq" ? styles.mBtnActive : ""}`}
            onClick={() => setMarket("kosdaq")}
          >
            코스닥
          </button>
        </div>
      </div>

      {/* 범례 */}
      <div className={styles.legend}>
        {SERIES.map((s) => (
          <button
            key={s.key}
            className={`${styles.legendBtn} ${!visibleSeries.has(s.key) ? styles.legendBtnOff : ""}`}
            onClick={() => toggleSeries(s.key)}
            title={visibleSeries.has(s.key) ? "클릭하여 숨기기" : "클릭하여 보기"}
          >
            <span className={styles.legendDot} style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* 차트 */}
      <div className={styles.chartArea}>
        {loading ? (
          <div className={styles.loading}>불러오는 중...</div>
        ) : data.length === 0 ? (
          <div className={styles.empty}>데이터가 없습니다</div>
        ) : (
          <LineChart data={filteredData} />
        )}
      </div>

      <p className={styles.unit}>단위: 백만원 (순매수 기준)</p>
    </div>
  );
}
