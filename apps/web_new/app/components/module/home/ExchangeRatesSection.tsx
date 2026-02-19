"use client";

import { useState, useEffect } from "react";
import { ExchangeRates } from "./ExchangeRates";
import type { ExchangeRateItem } from "@/lib/types";

/**
 * 환율 - Yahoo Finance 직접 호출 (/api/exchange-rate)
 */
export function ExchangeRatesSection() {
  const [rates, setRates] = useState<ExchangeRateItem[]>([]);
  const [baseTimestamp, setBaseTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/exchange-rate");
        const result = await response.json();

        if (result.success && result.data?.length > 0) {
          setRates(result.data);
          setBaseTimestamp(result.base_timestamp ?? null);
        } else {
          setRates([]);
          setBaseTimestamp(null);
        }
      } catch (err) {
        console.error("환율 로딩 실패:", err);
        setRates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  if (loading && rates.length === 0) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        환율 정보 불러오는 중...
      </div>
    );
  }

  return <ExchangeRates rates={rates} baseTimestamp={baseTimestamp} />;
}
