"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./InvestorTrendChart.module.css";

interface InvestorTrendItem {
  date: string;
  individual: number;
  foreign: number;
  institution: number;
  other: number;
}

const SERIES = [
  { key: "individual"  as const, label: "개인",    color: "#3b82f6" },
  { key: "foreign"     as const, label: "외국인",  color: "#f59e0b" },
  { key: "institution" as const, label: "기관계",  color: "#10b981" },
  { key: "other"       as const, label: "기타법인",color: "#8b5cf6" },
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
  const clean = d.replace(/[.\-\/]/g, "");
  if (clean.length === 8) return `${clean.slice(4, 6)}/${clean.slice(6, 8)}`;
  return d.replace(/\./g, "/").slice(-5);
}

function LineChart({ data }: { data: InvestorTrendItem[] }) {
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

  const allVals = data.flatMap((d) => SERIES.map((s) => d[s.key]));
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const range = rawMax - rawMin || 1;
  const pad = range * 0.15;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const xStep = innerW / (data.length - 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const zeroY = toY(0);
  const showZero = zeroY > PAD.top && zeroY < PAD.top + innerH;
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-label="투자자별 매매동향">
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

      {showZero && (
        <line x1={PAD.left} x2={PAD.left + innerW} y1={zeroY} y2={zeroY}
          stroke="var(--app-text-muted)" strokeWidth="0.8" strokeDasharray="3,3" />
      )}

      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={PAD.top + innerH + 14}
          textAnchor="middle" fontSize="8.5" fill="var(--app-text-muted)">
          {fmtDate(d.date)}
        </text>
      ))}

      {SERIES.map((s) => {
        const pts = data.map((d, i) => `${toX(i)},${toY(d[s.key])}`).join(" ");
        return (
          <g key={s.key}>
            <polyline points={pts} fill="none" stroke={s.color}
              strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
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
  const router = useRouter();
  const [market, setMarket] = useState<"kospi" | "kosdaq">(defaultMarket);
  const [data, setData] = useState<InvestorTrendItem[]>([]);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(SERIES.map((s) => s.key))
  );

  const fetchData = useCallback(async (m: "kospi" | "kosdaq") => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/naver-investor-trend?market=${m}`);
      const json = await res.json();
      const items = json.success && Array.isArray(json.data) && json.data.length > 0
        ? json.data
        : [];
      setData(items);
      setTimestamp(json.timestamp ?? null);
      if (items.length === 0) {
        // 디버깅: 브라우저 콘솔에서 확인 가능
        console.debug("[InvestorTrend] 데이터 없음", {
          success: json.success,
          dataLen: json.data?.length,
          headers: json.debug_headers,
          timestamp: json.timestamp,
        });
      }
    } catch (e) {
      console.error("[InvestorTrend] fetch 오류:", e);
      setData([]);
      setTimestamp(null);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(market); }, [market, fetchData]);

  const toggleSeries = (key: string) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredData: InvestorTrendItem[] = data.map((d) => {
    const copy = { ...d };
    SERIES.forEach((s) => { if (!visibleSeries.has(s.key)) copy[s.key] = 0; });
    return copy;
  });

  return (
    <div className={styles.wrapper}>
      {/* 헤더: 제목 + 기준시각 + 마켓 토글 */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>투자자별 매매동향</span>
          {timestamp && (
            <span className={styles.timestamp}>({timestamp} 기준)</span>
          )}
        </div>
        <div className={styles.marketToggle}>
          <button
            className={`${styles.mBtn} ${market === "kospi" ? styles.mBtnActive : ""}`}
            onClick={() => setMarket("kospi")}
          >코스피</button>
          <button
            className={`${styles.mBtn} ${market === "kosdaq" ? styles.mBtnActive : ""}`}
            onClick={() => setMarket("kosdaq")}
          >코스닥</button>
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
          <div className={styles.empty}>
            <span>{fetchError ? "데이터를 불러올 수 없습니다" : "수집된 데이터가 없습니다"}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => fetchData(market)}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <LineChart data={filteredData} />
        )}
      </div>

      {/* 하단: 단위 + 수급동향 더보기 */}
      <div className={styles.footer}>
        <p className={styles.unit}>단위: 백만원 (순매수 기준)</p>
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => router.push("/market/supply")}
        >
          수급동향 더보기 →
        </button>
      </div>
    </div>
  );
}
