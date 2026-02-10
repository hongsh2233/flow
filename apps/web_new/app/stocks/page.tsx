"use client";

import {
  TrendingUp,
  TrendingDown,
  Heart,
  BarChart3,
  Building2,
} from "lucide-react";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Search } from "../components/module/Search";
import { StockCard } from "../components/module/StockCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import type { StockDetail } from "@/lib/types";
import {
  kospiSectors,
  kosdaqSectors,
  marketCapStocks,
  risingStocks,
  favoriteStocksPage as favorite,
} from "@/lib/data/stocks";
import styles from "./StocksPage.module.css";

const LazyStockDetailModal = dynamic(
  () => import("../components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

function toStockDetail(s: { name: string; code: string; price: number; change: number | string; marketCap?: string }): StockDetail {
  const change = typeof s.change === "string" ? parseFloat(s.change) || 0 : s.change;
  return { name: s.name, code: s.code, price: s.price, change, marketCap: s.marketCap };
}

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("favorite");
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  return (
    <div className={styles.page}>
      {/* 검색 */}
      <div className={styles.searchArea}>
        <Search value={searchTerm} onChange={setSearchTerm} placeholder="종목명 또는 코드 검색" />
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={styles.tabList}>
          <TabsTrigger value="favorite">관심종목</TabsTrigger>
          <TabsTrigger value="market">시장현황</TabsTrigger>
          <TabsTrigger value="marketcap">시가총액</TabsTrigger>
          <TabsTrigger value="rising">상승종목</TabsTrigger>
        </TabsList>

        {/* 관심종목 */}
        <TabsContent value="favorite" className={styles.tabContent}>
          <div className={styles.cardList}>
            {favorite.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <button
                  key={stock.id}
                  type="button"
                  onClick={() => setSelectedStock(toStockDetail(stock))}
                  className={styles.favoriteCard}
                >
                  <div className={styles.favoriteInner}>
                    <div className={styles.favoriteLeft}>
                      <button type="button" className={styles.heartBtn} aria-label="관심종목">
                        <Heart className={styles.heart} aria-hidden />
                      </button>
                      <div className={styles.favoriteInfo}>
                        <h4>{stock.name}</h4>
                        <p>{stock.code}</p>
                      </div>
                    </div>
                    <div className={styles.favoriteRight}>
                      <p className={styles.favoritePrice}>{stock.price.toLocaleString()}</p>
                      <div className={styles.favoriteChangeRow}>
                        {isPositive ? (
                          <TrendingUp className={`${styles.changeIcon} ${styles.changeUp}`} aria-hidden />
                        ) : (
                          <TrendingDown className={`${styles.changeIcon} ${styles.changeDown}`} aria-hidden />
                        )}
                        <p className={isPositive ? styles.changeUp : styles.changeDown}>
                          {isPositive ? "+" : ""}
                          {stock.change}%
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* 시장현황 */}
        <TabsContent value="market" className={styles.tabContent}>
          <div className={styles.sectorSection}>
            <h3 className={styles.sectorTitle}>
              <BarChart3 className={styles.sectorIconBlue} aria-hidden />
              코스피 섹터별
            </h3>
            <div className={styles.sectorList}>
              {kospiSectors.map((sector) => {
                const isPositive = sector.change >= 0;
                return (
                  <div key={sector.name} className={styles.sectorCard}>
                    <div>
                      <p>{sector.name}</p>
                      <p>{sector.value}</p>
                    </div>
                    <p className={`${styles.sectorChange} ${isPositive ? styles.sectorChangeUp : styles.sectorChangeDown}`}>
                      {isPositive ? "+" : ""}
                      {sector.change}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.sectorSection}>
            <h3 className={styles.sectorTitle}>
              <Building2 className={styles.sectorIconPurple} aria-hidden />
              코스닥 섹터별
            </h3>
            <div className={styles.sectorList}>
              {kosdaqSectors.map((sector) => {
                const isPositive = sector.change >= 0;
                return (
                  <div key={sector.name} className={styles.sectorCard}>
                    <div>
                      <p>{sector.name}</p>
                      <p>{sector.value}</p>
                    </div>
                    <p className={`${styles.sectorChange} ${isPositive ? styles.sectorChangeUp : styles.sectorChangeDown}`}>
                      {isPositive ? "+" : ""}
                      {sector.change}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* 시가총액 */}
        <TabsContent value="marketcap" className={styles.tabContent}>
          <div className={styles.cardList}>
            {marketCapStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <button
                  key={stock.rank}
                  type="button"
                  onClick={() => setSelectedStock(toStockDetail(stock))}
                  className={styles.marketCapCard}
                >
                  <div className={styles.marketCapInner}>
                    <div className={styles.rankBadgeOrange}>
                      <span>{stock.rank}</span>
                    </div>
                    <div className={styles.marketCapInfo}>
                      <h4>{stock.name}</h4>
                      <p>{stock.code}</p>
                    </div>
                    <div className={styles.marketCapPrice}>
                      <p>{stock.price.toLocaleString()}</p>
                      <p className={isPositive ? styles.changeUp : styles.changeDown}>
                        {isPositive ? "+" : ""}
                        {stock.change}%
                      </p>
                    </div>
                    <div className={styles.marketCapCol}>
                      <p>시총</p>
                      <p>{stock.marketCap}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* 상승종목 */}
        <TabsContent value="rising" className={styles.tabContent}>
          <StockCard
            stocks={risingStocks}
            onSelect={(s) => setSelectedStock(toStockDetail(s))}
          />
        </TabsContent>
      </Tabs>

      {/* 모달 */}
      {selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
