"use client";

import { useState } from "react";
import { FavoriteStocks } from "./components/module/home/FavoriteStocks";
import { ExchangeRates } from "./components/module/home/ExchangeRates";
import { MarketIndex } from "./components/module/home/MarketIndex";
import { RealtimeSearch } from "./components/module/home/RealtimeSearch";
import { TradeRanking } from "./components/module/home/TradeRanking";
import { StockTermBox } from "./components/module/stock-term-box";
import { StockDetailModal } from "./components/module/StockDetailModal";
import type { StockDetail } from "@/lib/types";

/* ── 더미 데이터 ── */

const realtimeSearch = [
  { rank: 1, name: "삼성전자", change: 1.7 },
  { rank: 2, name: "에코프로", change: 12.5 },
  { rank: 3, name: "SK하이닉스", change: -1.76 },
  { rank: 4, name: "LG에너지", change: 0.89 },
  { rank: 5, name: "NAVER", change: 1.52 },
  { rank: 6, name: "카카오", change: -1.72 },
  { rank: 7, name: "현대차", change: 1.02 },
  { rank: 8, name: "셀트리온", change: 2.1 },
  { rank: 9, name: "포스코", change: 0.88 },
  { rank: 10, name: "삼성바이오", change: -1.5 },
];

const kospiVolume = [
  { rank: 1, name: "삼성전자", code: "005930", price: 71800, change: 1.7, volume: "12.3M" },
  { rank: 2, name: "SK하이닉스", code: "000660", price: 128500, change: -1.76, volume: "8.2M" },
  { rank: 3, name: "현대차", code: "005380", price: 198000, change: 1.02, volume: "5.4M" },
  { rank: 4, name: "기아", code: "000270", price: 89000, change: 0.56, volume: "4.7M" },
  { rank: 5, name: "POSCO홀딩스", code: "005490", price: 345000, change: 0.88, volume: "3.9M" },
  { rank: 6, name: "LG화학", code: "051910", price: 456000, change: 1.11, volume: "3.2M" },
  { rank: 7, name: "삼성SDI", code: "006400", price: 345000, change: 1.3, volume: "2.8M" },
  { rank: 8, name: "LG전자", code: "066570", price: 98000, change: 0.42, volume: "2.5M" },
  { rank: 9, name: "KB금융", code: "105560", price: 67800, change: 0.85, volume: "2.3M" },
  { rank: 10, name: "신한지주", code: "055550", price: 45200, change: -0.44, volume: "2.1M" },
];

const kosdaqVolume = [
  { rank: 1, name: "에코프로비엠", code: "247540", price: 234500, change: 12.5, volume: "6.7M" },
  { rank: 2, name: "셀트리온헬스케어", code: "091990", price: 89000, change: 2.3, volume: "4.5M" },
  { rank: 3, name: "알테오젠", code: "196170", price: 145000, change: 3.1, volume: "3.8M" },
  { rank: 4, name: "엔켐", code: "348370", price: 67000, change: -1.2, volume: "3.2M" },
  { rank: 5, name: "리노공업", code: "058470", price: 234000, change: 1.8, volume: "2.9M" },
  { rank: 6, name: "위메이드", code: "112040", price: 56000, change: -2.1, volume: "2.6M" },
  { rank: 7, name: "펄어비스", code: "263750", price: 78000, change: 0.9, volume: "2.3M" },
  { rank: 8, name: "카카오게임즈", code: "293490", price: 45000, change: 1.5, volume: "2.1M" },
  { rank: 9, name: "씨젠", code: "096530", price: 34000, change: -0.8, volume: "1.9M" },
  { rank: 10, name: "에이치엘비", code: "028300", price: 23000, change: 2.7, volume: "1.7M" },
];

const kospiValue = [
  { rank: 1, name: "삼성전자", price: 71800, change: 1.7, value: "8,834억" },
  { rank: 2, name: "SK하이닉스", price: 128500, change: -1.76, value: "6,127억" },
  { rank: 3, name: "LG에너지솔루션", price: 456000, change: 0.89, value: "4,521억" },
  { rank: 4, name: "현대차", price: 198000, change: 1.02, value: "3,892억" },
  { rank: 5, name: "POSCO홀딩스", price: 345000, change: 0.88, value: "2,945억" },
  { rank: 6, name: "LG화학", price: 456000, change: 1.11, value: "2,734억" },
  { rank: 7, name: "삼성바이오로직스", price: 789000, change: -1.5, value: "2,456억" },
  { rank: 8, name: "기아", price: 89000, change: 0.56, value: "2,123억" },
  { rank: 9, name: "셀트리온", price: 178000, change: 2.1, value: "1,987억" },
  { rank: 10, name: "NAVER", price: 234500, change: 1.52, value: "1,845억" },
];

const kosdaqValue = [
  { rank: 1, name: "에코프로비엠", price: 234500, change: 12.5, value: "1,572억" },
  { rank: 2, name: "셀트리온헬스케어", price: 89000, change: 2.3, value: "1,234억" },
  { rank: 3, name: "알테오젠", price: 145000, change: 3.1, value: "987억" },
  { rank: 4, name: "포스코퓨처엠", price: 456000, change: 9.8, value: "876억" },
  { rank: 5, name: "엔켐", price: 67000, change: -1.2, value: "745억" },
  { rank: 6, name: "리노공업", price: 234000, change: 1.8, value: "678억" },
  { rank: 7, name: "위메이드", price: 56000, change: -2.1, value: "589억" },
  { rank: 8, name: "펄어비스", price: 78000, change: 0.9, value: "512억" },
  { rank: 9, name: "카카오게임즈", price: 45000, change: 1.5, value: "467억" },
  { rank: 10, name: "씨젠", price: 34000, change: -0.8, value: "398억" },
];

const favoriteStocks = [
  { id: "1", name: "삼성전자", code: "005930", price: 71800, change: 1.7 },
  { id: "2", name: "NAVER", code: "035420", price: 234500, change: 1.52 },
  { id: "3", name: "카카오", code: "035720", price: 45600, change: -1.72 },
  { id: "4", name: "현대차", code: "005380", price: 198000, change: 1.02 },
];

const exchangeRates = [
  { currency: "USD", rate: "1,342.50", change: "+5.20", isPositive: true },
  { currency: "JPY", rate: "912.34", change: "-2.15", isPositive: false },
  { currency: "EUR", rate: "1,456.78", change: "+3.42", isPositive: true },
];

const marketIndices = [
  { name: "코스피", value: "2,456.78", change: "+12.34 (0.51%)", isPositive: true },
  { name: "코스닥", value: "756.23", change: "-3.45 (-0.45%)", isPositive: false },
];

/* ── 메인 페이지 ── */

export default function Home() {
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);

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
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
