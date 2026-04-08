"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/search/SearchPage.module.css";

/* ── 타입 ── */
interface TrendDataPoint {
  period: string;
  ratio: number;
}

interface TrendGroup {
  keyword_group: string;
  keywords: string[];
  data: TrendDataPoint[];
}

/* ── 색상 (10개 테마) ── */
const COLORS = [
  "#e74c3c", "#2ecc71", "#3498db", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#2c3e50", "#d35400", "#c0392b",
];

/* ── SVG 차트 ── */
function TrendChart({ groups }: { groups: TrendGroup[] }) {
  const W = 700;
  const H = 220;
  const PAD = { top: 10, right: 10, bottom: 30, left: 35 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // 모든 그룹의 기간 합쳐서 고유 날짜 정렬
  const allDates = Array.from(
    new Set(groups.flatMap((g) => g.data.map((d) => d.period)))
  ).sort();

  if (allDates.length === 0) return null;

  const xScale = (i: number) => PAD.left + (i / Math.max(allDates.length - 1, 1)) * plotW;
  const yScale = (v: number) => PAD.top + plotH - (v / 100) * plotH;

  // X축 라벨 (5~6개만)
  const xStep = Math.max(1, Math.floor(allDates.length / 5));
  const xLabels = allDates.filter((_, i) => i % xStep === 0 || i === allDates.length - 1);

  return (
    <div className={styles.trendChart}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="100%">
        {/* Y축 그리드 */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)}
              stroke="var(--app-border-light, #e5e7eb)" strokeWidth={0.5}
            />
            <text x={PAD.left - 4} y={yScale(v) + 3} textAnchor="end"
              fontSize={9} fill="var(--app-text-muted, #888)">
              {v}
            </text>
          </g>
        ))}

        {/* X축 라벨 */}
        {xLabels.map((dt) => {
          const idx = allDates.indexOf(dt);
          return (
            <text key={dt} x={xScale(idx)} y={H - 4} textAnchor="middle"
              fontSize={8} fill="var(--app-text-muted, #888)">
              {dt.slice(5)}
            </text>
          );
        })}

        {/* 라인 */}
        {groups.map((g, gi) => {
          const points = g.data
            .map((d) => {
              const xi = allDates.indexOf(d.period);
              if (xi < 0) return null;
              return `${xScale(xi)},${yScale(d.ratio)}`;
            })
            .filter(Boolean)
            .join(" ");
          return (
            <polyline
              key={g.keyword_group}
              points={points}
              fill="none"
              stroke={COLORS[gi % COLORS.length]}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {/* 범례 */}
      <div className={styles.trendLegend}>
        {groups.map((g, gi) => (
          <span key={g.keyword_group} className={styles.trendLegendItem}>
            <span
              className={styles.trendLegendDot}
              style={{ background: COLORS[gi % COLORS.length] }}
            />
            {g.keyword_group}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 자동 스크롤 키워드 리스트 ── */
function AutoScrollList({ groups }: { groups: TrendGroup[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (groups.length === 0) return;

    const interval = setInterval(() => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;

      const rowH = inner.firstElementChild?.getBoundingClientRect().height ?? 32;
      const maxOffset = inner.scrollHeight - wrap.clientHeight;

      setOffset((prev) => {
        const next = prev + rowH;
        if (next >= maxOffset) return 0;
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [groups]);

  return (
    <div ref={wrapRef} className={styles.trendListWrap}>
      <div
        ref={innerRef}
        className={styles.trendListInner}
        style={{ transform: `translateY(-${offset}px)` }}
      >
        {groups.map((g, gi) => (
          <div key={g.keyword_group} className={styles.trendRow}>
            <span
              className={styles.trendRowDot}
              style={{ background: COLORS[gi % COLORS.length] }}
            />
            <span className={styles.trendRowTheme}>{g.keyword_group}</span>
            <span className={styles.trendRowKeywords}>
              {g.keywords.join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export function SearchTrendSection() {
  const [groups, setGroups] = useState<TrendGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/naver-trend?category=테마섹터&time_unit=date")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setGroups(j.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // 데이터 없으면 숨김
  if (!loaded || groups.length === 0) return null;

  return (
    <section className={styles.trendSection}>
      <h4 className={styles.trendTitle}>검색 트렌드</h4>
      <TrendChart groups={groups} />
      <AutoScrollList groups={groups} />
    </section>
  );
}
