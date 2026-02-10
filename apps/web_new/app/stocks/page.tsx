"use client";

import {
  TrendingUp,
  TrendingDown,
  Heart,
  BarChart3,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { Search } from "../components/module/Search";
import { StockCard } from "../components/module/StockCard";
import { StockDetailModal } from "../components/module/StockDetailModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import type {
  RisingStock,
  StockDetail,
  FavoriteStock,
  SectorData,
  MarketCapStock,
} from "@/lib/types";
import styles from "./StocksPage.module.css";

// 섹터 데이터
const kospiSectors: SectorData[] = [
  { name: "반도체", change: 2.3, value: 1245.67 },
  { name: "자동차", change: 1.5, value: 892.34 },
  { name: "금융", change: 0.8, value: 567.89 },
  { name: "화학", change: -0.5, value: 432.12 },
  { name: "철강", change: -1.2, value: 345.67 },
];

const kosdaqSectors: SectorData[] = [
  { name: "IT/소프트웨어", change: 3.1, value: 234.56 },
  { name: "바이오", change: 2.8, value: 456.78 },
  { name: "게임", change: 1.2, value: 189.34 },
  { name: "제약", change: -0.3, value: 278.91 },
  { name: "미디어", change: -1.5, value: 123.45 },
];

// 시가총액 상위
const marketCapStocks: MarketCapStock[] = [
  { rank: 1, name: "삼성전자", code: "005930", price: 71800, change: 1.7, marketCap: "428조" },
  { rank: 2, name: "SK하이닉스", code: "000660", price: 128500, change: -1.76, marketCap: "93조" },
  { rank: 3, name: "삼성바이오로직스", code: "207940", price: 789000, change: -1.5, marketCap: "56조" },
  { rank: 4, name: "NAVER", code: "035420", price: 234500, change: 1.52, marketCap: "38조" },
  { rank: 5, name: "LG에너지솔루션", code: "373220", price: 456000, change: 0.89, marketCap: "106조" },
  { rank: 6, name: "카카오", code: "035720", price: 45600, change: -1.72, marketCap: "20조" },
  { rank: 7, name: "현대차", code: "005380", price: 198000, change: 1.02, marketCap: "42조" },
  { rank: 8, name: "기아", code: "000270", price: 89000, change: 0.56, marketCap: "35조" },
  { rank: 9, name: "셀트리온", code: "068270", price: 178000, change: 2.1, marketCap: "24조" },
  { rank: 10, name: "삼성SDI", code: "006400", price: 345000, change: 1.3, marketCap: "23조" },
];

// 상승종목 상위
const risingStocks: RisingStock[] = [
  { rank: 1, name: "에코프로비엠", code: "247540", price: 234500, change: 12.5 },
  { rank: 2, name: "포스코퓨처엠", code: "003670", price: 456000, change: 9.8 },
  { rank: 3, name: "LG화학", code: "051910", price: 567000, change: 8.3 },
  { rank: 4, name: "POSCO홀딩스", code: "005490", price: 345000, change: 7.2 },
  { rank: 5, name: "삼성전자", code: "005930", price: 71800, change: 6.5 },
  { rank: 6, name: "현대차", code: "005380", price: 198000, change: 5.9 },
  { rank: 7, name: "기아", code: "000270", price: 89000, change: 5.3 },
  { rank: 8, name: "SK이노베이션", code: "096770", price: 123000, change: 4.8 },
  { rank: 9, name: "LG전자", code: "066570", price: 98000, change: 4.2 },
  { rank: 10, name: "삼성물산", code: "028260", price: 134000, change: 3.7 },
];

// 관심종목
const favorite: FavoriteStock[] = [
  { id: "1", name: "삼성전자", code: "005930", price: 71800, change: 1.7 },
  { id: "2", name: "NAVER", code: "035420", price: 234500, change: 1.52 },
  { id: "3", name: "KB금융", code: "105560", price: 67800, change: 0.85 },
  { id: "4", name: "삼성바이오", code: "207940", price: 789000, change: -1.5 },
];

function toStockDetail(s: { name: string; code: string; price: number; change: number | string; marketCap?: string }): StockDetail {
  const change = typeof s.change === "string" ? parseFloat(s.change) || 0 : s.change;
  return { name: s.name, code: s.code, price: s.price, change, marketCap: s.marketCap };
}

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("favorite");
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);

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
              {kospiSectors.map((sector, index) => {
                const isPositive = sector.change >= 0;
                return (
                  <div key={index} className={styles.sectorCard}>
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
              {kosdaqSectors.map((sector, index) => {
                const isPositive = sector.change >= 0;
                return (
                  <div key={index} className={styles.sectorCard}>
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
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
