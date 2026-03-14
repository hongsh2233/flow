"use client";

import { useState, useEffect } from "react";
import { MarketIndex } from "./MarketIndex";
import type { MarketIndexItem } from "@/lib/types";

interface DomesticIndexItem {
  name: string;
  value: string;
  change: string;
  percent: string;
}

/**
 * 국내 지수 - BO /api/domestic-indices 경유 (코스피/코스닥)
 */
export function MarketIndexSection() {
  const [indices, setIndices] = useState<MarketIndexItem[]>([]);
  const [collectedDate, setCollectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/domestic-indices");
        const result = await response.json();

        if (result.success && result.data?.length > 0) {
          const mapped: MarketIndexItem[] = result.data.map((item: DomesticIndexItem) => ({
            name: item.name,
            value: item.value,
            change: `${item.change} (${item.percent})`,
            isPositive: item.change.startsWith("+") || parseFloat(item.change) >= 0,
          }));
          setIndices(mapped);
          setCollectedDate(result.timestamp ?? null);
        } else {
          setIndices([]);
          setCollectedDate(null);
        }
      } catch (err) {
        console.error("국내 지수 로딩 실패:", err);
        setIndices([]);
        setCollectedDate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && indices.length === 0) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        주요 지수 불러오는 중...
      </div>
    );
  }

  return <MarketIndex indices={indices} collectedDate={collectedDate} />;
}
