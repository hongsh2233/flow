"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { FavoriteStocks } from "./components/module/home/FavoriteStocks";
import { ExchangeRates } from "./components/module/home/ExchangeRates";
import { MarketIndex } from "./components/module/home/MarketIndex";
import { RealtimeSearch } from "./components/module/home/RealtimeSearch";
import { TradeRanking } from "./components/module/home/TradeRanking";
import { StockTermBox } from "./components/module/stock-term-box";
import type { StockDetail } from "@/lib/types";
import {
  realtimeSearch,
  kospiVolume,
  kosdaqVolume,
  kospiValue,
  kosdaqValue,
  favoriteStocks,
  exchangeRates,
  marketIndices,
} from "@/lib/data/home";

const LazyStockDetailModal = dynamic(
  () => import("./components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

export default function Home() {
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  return (
    <div className="content__wrap">
      <div className="home-term-wrap">
        <StockTermBox />
      </div>

      <FavoriteStocks stocks={favoriteStocks} onSelect={setSelectedStock} />
      <ExchangeRates rates={exchangeRates} />
      <MarketIndex indices={marketIndices} />
      <RealtimeSearch items={realtimeSearch} />
      <TradeRanking
        kospiVolume={kospiVolume}
        kosdaqVolume={kosdaqVolume}
        kospiValue={kospiValue}
        kosdaqValue={kosdaqValue}
        onSelect={setSelectedStock}
      />

      {selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
