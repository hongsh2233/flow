"use client";

import { useState, useEffect, useCallback } from "react";
import { TradeRanking } from "./TradeRanking";
import type { VolumeStock, ValueStock, StockDetail } from "@/lib/types";

interface NaverRankingItem {
  rank: number;
  stock_code: string;
  stock_name: string;
  current_price: number | string;
  change: number | string;
  change_percent: number | string;
  volume?: string;
  amount?: string;
}

function parseNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * 거래 상위 (네이버 랭킹) - BO /api/naver-stock-ranking 경유
 */
export function TradeRankingSection({ onSelect }: { onSelect: (stock: StockDetail) => void }) {
  const [kospiVolume, setKospiVolume] = useState<VolumeStock[]>([]);
  const [kosdaqVolume, setKosdaqVolume] = useState<VolumeStock[]>([]);
  const [kospiValue, setKospiValue] = useState<ValueStock[]>([]);
  const [kosdaqValue, setKosdaqValue] = useState<ValueStock[]>([]);
  const [baseTimestamp, setBaseTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mapVolume = useCallback((items: NaverRankingItem[]): VolumeStock[] => {
    return items.map((item) => ({
      rank: item.rank,
      name: item.stock_name ?? "-",
      code: item.stock_code ?? "",
      price: parseNum(item.current_price),
      change: parseNum(item.change_percent),
      volume: item.volume ?? "-",
    }));
  }, []);

  const mapValue = useCallback((items: NaverRankingItem[]): ValueStock[] => {
    return items.map((item) => ({
      rank: item.rank,
      name: item.stock_name ?? "-",
      price: parseNum(item.current_price),
      change: parseNum(item.change_percent),
      value: item.amount ?? "-",
    }));
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [vKospi, vKosdaq, aKospi, aKosdaq] = await Promise.all([
          fetch("/api/naver-ranking?ranking_type=volume&market_type=kospi&limit=10").then((r) => r.json()),
          fetch("/api/naver-ranking?ranking_type=volume&market_type=kosdaq&limit=10").then((r) => r.json()),
          fetch("/api/naver-ranking?ranking_type=amount&market_type=kospi&limit=10").then((r) => r.json()),
          fetch("/api/naver-ranking?ranking_type=amount&market_type=kosdaq&limit=10").then((r) => r.json()),
        ]);

        setKospiVolume(vKospi.success && vKospi.data ? mapVolume(vKospi.data) : []);
        setKosdaqVolume(vKosdaq.success && vKosdaq.data ? mapVolume(vKosdaq.data) : []);
        setKospiValue(aKospi.success && aKospi.data ? mapValue(aKospi.data) : []);
        setKosdaqValue(aKosdaq.success && aKosdaq.data ? mapValue(aKosdaq.data) : []);
        setBaseTimestamp(vKospi.base_timestamp ?? aKospi.base_timestamp ?? null);
      } catch (err) {
        console.error("네이버 랭킹 로딩 실패:", err);
        setKospiVolume([]);
        setKosdaqVolume([]);
        setKospiValue([]);
        setKosdaqValue([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [mapVolume, mapValue]);

  if (loading) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        거래 상위 데이터 불러오는 중...
      </div>
    );
  }

  return (
    <TradeRanking
      kospiVolume={kospiVolume}
      kosdaqVolume={kosdaqVolume}
      kospiValue={kospiValue}
      kosdaqValue={kosdaqValue}
      onSelect={onSelect}
      baseTimestamp={baseTimestamp}
    />
  );
}
