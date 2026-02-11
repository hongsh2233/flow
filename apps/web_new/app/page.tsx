"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { FavoriteStocks } from "./components/module/home/FavoriteStocks";
import { ExchangeRates } from "./components/module/home/ExchangeRates";
import { MarketIndex } from "./components/module/home/MarketIndex";
import { RealtimeSearch } from "./components/module/home/RealtimeSearch";
import { TradeRanking } from "./components/module/home/TradeRanking";
import { StockTermBox } from "./components/module/stock-term-box";
import { AdBanner } from "./components/module/AdBanner";
import type { StockDetail, AdBannerItem } from "@/lib/types";
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

const adBanners: AdBannerItem[] = [
  {
    title: "초보 투자자를 위한 무료 강의",
    description: "주식 기초부터 차트 분석까지 한 번에!",
    label: "EVENT",
    emoji: "📚",
    gradient: "orange",
    href: "#",
    closeable: true,
  },
  {
    title: "실시간 시장 알림 받기",
    description: "관심 종목 가격 변동을 놓치지 마세요",
    label: "NEW",
    emoji: "🔔",
    gradient: "blue",
    href: "#",
    closeable: true,
  },
  {
    title: "AI 종목 추천 리포트",
    description: "나만의 맞춤 포트폴리오를 만들어 보세요",
    label: "HOT",
    emoji: "🤖",
    gradient: "green",
    href: "#",
    closeable: true,
  },
];

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

      <AdBanner items={adBanners} autoSlide interval={5000} />

      {selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
