"use client";

import { useState, useEffect } from "react";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import styles from "./ForeignIndices.module.css";

interface ForeignIndexItem {
  name: string;
  symbol: string;
  value: string;
  change: string;
  percent: string;
}

function formatBaseTimestamp(ts: string | null | undefined): string {
  if (!ts) return "";
  try {
    const [datePart] = ts.split(" ");
    const [y, m, d] = datePart.split("-").map(Number);
    if (m && d) return `${m}월 ${d}일 장 마감 기준`;
  } catch {
    return `수집일자: ${ts}`;
  }
  return `수집일자: ${ts}`;
}

/**
 * 해외지수 - BO /api/foreign-indices 경유 (Yahoo Finance 프록시)
 */
export function ForeignIndices() {
  const [indices, setIndices] = useState<ForeignIndexItem[]>([]);
  const [baseTimestamp, setBaseTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIndices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/foreign-indices");
      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        setIndices(result.data);
        setBaseTimestamp(result.base_timestamp ?? null);
      } else {
        setIndices([]);
        setBaseTimestamp(null);
      }
    } catch (err) {
      console.error("해외지수 로딩 실패:", err);
      setError("해외지수를 불러오는데 실패했습니다.");
      setIndices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndices();
  }, []);

  if (loading && indices.length === 0) {
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>
          <Globe className={styles.headingIcon} />
          해외 지수
        </h3>
        <div className={styles.loading}>지수를 불러오는 중...</div>
      </div>
    );
  }

  if (error && indices.length === 0) {
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>
          <Globe className={styles.headingIcon} />
          해외 지수
        </h3>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <Globe className={styles.headingIcon} />
          해외 지수
        </h3>
        {baseTimestamp && (
          <span className={styles.baseTimestamp}>
            {formatBaseTimestamp(baseTimestamp)}
          </span>
        )}
      </div>
      <div className={styles.grid}>
        {indices.map((item, idx) => {
          const pct = parseFloat(item.percent);
          const isNeutral = pct === 0;
          const isUp = !isNeutral && (item.change.startsWith("+") || parseFloat(item.change) >= 0);
          const cardVariant = isNeutral ? styles.cardNeutral : isUp ? styles.cardUp : styles.cardDown;
          const textVariant = isNeutral ? styles.changeNeutral : isUp ? styles.changeUp : styles.changeDown;
          return (
            <div
              key={`${item.symbol}-${idx}`}
              className={`${styles.card} ${cardVariant}`}
            >
              <p className={styles.label}>{item.name}</p>
              <p className={styles.value}>{item.value}</p>
              <div className={styles.changeRow}>
                {isNeutral ? null : isUp ? (
                  <TrendingUp className={`${styles.changeIcon} ${styles.changeIconUp}`} />
                ) : (
                  <TrendingDown className={`${styles.changeIcon} ${styles.changeIconDown}`} />
                )}
                <p className={`${styles.changeText} ${textVariant}`}>
                  {item.change} ({item.percent})
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
