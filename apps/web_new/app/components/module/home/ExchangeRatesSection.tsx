"use client";

import { useState, useEffect } from "react";
import { ExchangeRates } from "./ExchangeRates";
import type { ExchangeRateItem, InterestRateItem } from "@/lib/types";

/**
 * 환율&금리 - Yahoo Finance 데이터 조회
 * 환율: /api/exchange-rate (30분마다 DB 저장)
 * 금리: /api/interest-rate (on-demand, 1시간 캐시)
 */
export function ExchangeRatesSection() {
  const [rates, setRates] = useState<ExchangeRateItem[]>([]);
  const [interestRates, setInterestRates] = useState<InterestRateItem[]>([]);
  const [baseTimestamp, setBaseTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [exRes, irRes] = await Promise.all([
          fetch("/api/exchange-rate"),
          fetch("/api/interest-rate"),
        ]);

        const exJson = await exRes.json();
        if (exJson.success && exJson.data?.length > 0) {
          setRates(exJson.data);
          setBaseTimestamp(exJson.base_timestamp ?? null);
        }

        const irJson = await irRes.json();
        if (irJson.success && irJson.data?.length > 0) {
          setInterestRates(irJson.data);
        }
      } catch (err) {
        console.error("환율/금리 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading && rates.length === 0 && interestRates.length === 0) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        환율/금리 정보 불러오는 중...
      </div>
    );
  }

  return <ExchangeRates rates={rates} interestRates={interestRates} baseTimestamp={baseTimestamp} />;
}
