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

/**
 * 해외지수 - BO /api/foreign-indices 경유 (Yahoo Finance 프록시)
 */
export function ForeignIndices() {
  const [indices, setIndices] = useState<ForeignIndexItem[]>([]);
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
      } else {
        setIndices([]);
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
    const interval = setInterval(fetchIndices, 5 * 60 * 1000);
    return () => clearInterval(interval);
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
      <h3 className={styles.heading}>
        <Globe className={styles.headingIcon} />
        해외 지수
      </h3>
      <div className={styles.grid}>
        {indices.map((item, idx) => {
          const isUp = item.change.startsWith("+") || parseFloat(item.change) >= 0;
          return (
            <div key={`${item.symbol}-${idx}`} className={styles.card}>
              <p className={styles.label}>{item.name}</p>
              <p className={styles.value}>{item.value}</p>
              <div className={styles.changeRow}>
                {isUp ? (
                  <TrendingUp className={`${styles.changeIcon} ${styles.changeIconUp}`} />
                ) : (
                  <TrendingDown className={`${styles.changeIcon} ${styles.changeIconDown}`} />
                )}
                <p className={`${styles.changeText} ${isUp ? styles.changeUp : styles.changeDown}`}>
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
