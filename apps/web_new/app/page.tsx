"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import type { StockDetail } from "@/lib/types";
import { StockTermBox } from "./components/module/stock-term-box";
import { FavoriteStocks } from "./components/module/home/FavoriteStocks";
import { MarketIndexSection } from "./components/module/home/MarketIndexSection";
import { ForeignIndices } from "./components/module/home/ForeignIndices";
import { ExchangeRatesSection } from "./components/module/home/ExchangeRatesSection";
import { TradeRankingSection } from "./components/module/home/TradeRankingSection";
import { RealtimeSearchSection } from "./components/module/home/RealtimeSearchSection";
const LazyStockDetailModal = dynamic(
  () => import("./components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

export default function Home() {
  const { status } = useSession();
  const { favoriteStocks, isLoading: isLoadingFavorites } = useFavoriteStocks();
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  return (
    <div className="content__wrap">
      <div className="home-term-wrap">
        <StockTermBox />
      </div>

      <ForeignIndices />
      <MarketIndexSection />

      {status === "loading" ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          로그인 정보 확인 중...
        </div>
      ) : status === "authenticated" ? (
        isLoadingFavorites ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
            관심종목 불러오는 중...
          </div>
        ) : (
          <FavoriteStocks stocks={favoriteStocks} onSelect={setSelectedStock} />
        )
      ) : (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          <p>로그인 후 관심종목을 등록하고 확인할 수 있습니다.</p>
          <a href="/login" style={{ color: "var(--app-accent)", marginTop: "0.5rem", display: "inline-block" }}>
            로그인하기
          </a>
        </div>
      )}

      <ExchangeRatesSection />
      <TradeRankingSection onSelect={setSelectedStock} />
      <RealtimeSearchSection />

      {selectedStock && <LazyStockDetailModal stock={selectedStock} onClose={handleClose} />}
    </div>
  );
}
