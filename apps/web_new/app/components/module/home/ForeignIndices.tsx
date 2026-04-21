"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { parseIndexChangeStrings } from "@/lib/utils/indexChangeDirection";
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
    const [datePart, timePart] = ts.split(" ");
    const [, m, d] = datePart.split("-").map(Number);
    if (m && d) {
      return timePart ? `${m}/${d} ${timePart}` : `${m}/${d}`;
    }
  } catch {
    // fallthrough
  }
  return ts;
}

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
      setError("불러오기 실패");
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
        <div className={styles.loading}>지수를 불러오는 중...</div>
      </div>
    );
  }

  if (error && indices.length === 0) {
    return (
      <div className={styles.section}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      {baseTimestamp && (
        <p className={styles.timestamp}>{formatBaseTimestamp(baseTimestamp)} 기준</p>
      )}
      <div className={styles.grid}>
        {indices.map((item, idx) => {
          const { isNeutral, isPositive: isUp } = parseIndexChangeStrings(item.change, item.percent);
          const cardVariant = isNeutral ? styles.cardNeutral : isUp ? styles.cardUp : styles.cardDown;
          const textVariant = isNeutral ? styles.changeNeutral : isUp ? styles.changeUp : styles.changeDown;
          return (
            <div key={`${item.symbol}-${idx}`} className={`${styles.card} ${cardVariant}`}>
              <p className={styles.label}>{item.name}</p>
              <p className={styles.value}>{item.value}</p>
              <div className={styles.changeRow}>
                {isNeutral ? null : isUp ? (
                  <TrendingUp className={`${styles.changeIcon} ${styles.changeIconUp}`} />
                ) : (
                  <TrendingDown className={`${styles.changeIcon} ${styles.changeIconDown}`} />
                )}
                <p className={`${styles.changeText} ${textVariant}`}>
                  {item.percent}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
