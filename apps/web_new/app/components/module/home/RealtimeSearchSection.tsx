"use client";

import { useState, useEffect } from "react";
import { RealtimeSearch } from "./RealtimeSearch";
import type { RealtimeSearchItem } from "@/lib/types";

interface NaverSearchItem {
  rank: number;
  stock_code: string;
  stock_name: string;
  current_price: number | string;
  change: number | string;
  change_percent: number | string;
}

/**
 * 실시간 검색 상위 - BO /api/naver-stock-ranking (ranking_type=search)
 */
export function RealtimeSearchSection() {
  const [items, setItems] = useState<RealtimeSearchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSearch = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/naver-ranking?ranking_type=search&market_type=all&limit=10");
        const result = await response.json();

        if (result.success && result.data?.length > 0) {
          const mapped: RealtimeSearchItem[] = result.data.map((item: NaverSearchItem) => {
            const change = typeof item.change_percent === "number"
              ? item.change_percent
              : parseFloat(String(item.change_percent || 0).replace(/,/g, "")) || 0;
            return {
              rank: item.rank,
              name: item.stock_name ?? "-",
              change,
            };
          });
          setItems(mapped);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error("검색 상위 로딩 실패:", err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSearch();
  }, []);

  if (loading && items.length === 0) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        실시간 검색 상위 불러오는 중...
      </div>
    );
  }

  return <RealtimeSearch items={items} />;
}
