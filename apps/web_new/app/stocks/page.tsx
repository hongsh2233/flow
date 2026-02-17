"use client";

import {
  TrendingUp,
  TrendingDown,
  Heart,
  BarChart3,
  Building2,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search } from "../components/module/Search";
import { StockCard } from "../components/module/StockCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import type { StockDetail, MarketCapStock, RisingStock } from "@/lib/types";
import {
  kospiSectors,
  kosdaqSectors,
  favoriteStocksPage as favorite,
} from "@/lib/data/stocks";
import styles from "./StocksPage.module.css";

const LazyStockDetailModal = dynamic(
  () => import("../components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

function formatMarketCap(value: string | number | undefined): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) || 0 : Number(value) || 0;
  if (num >= 1e12) return `${Math.floor(num / 1e12)}조`;
  if (num >= 1e8) return `${Math.floor(num / 1e8)}억`;
  return num >= 0 ? num.toLocaleString() : "-";
}

function toStockDetail(s: { name: string; code: string; price: number; change: number | string; marketCap?: string }): StockDetail {
  const change = typeof s.change === "string" ? parseFloat(s.change) || 0 : s.change;
  return { name: s.name, code: s.code, price: s.price, change, marketCap: s.marketCap };
}

type MarketType = "KOSPI" | "KOSDAQ";

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("favorite");
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  const [marketCapTab, setMarketCapTab] = useState<MarketType>("KOSPI");
  const [risingTab, setRisingTab] = useState<MarketType>("KOSPI");
  const [marketCapKospi, setMarketCapKospi] = useState<MarketCapStock[]>([]);
  const [marketCapKosdaq, setMarketCapKosdaq] = useState<MarketCapStock[]>([]);
  const [risingKospi, setRisingKospi] = useState<RisingStock[]>([]);
  const [risingKosdaq, setRisingKosdaq] = useState<RisingStock[]>([]);
  const [marketCapLoading, setMarketCapLoading] = useState(false);
  const [risingLoading, setRisingLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "marketcap") return;
    const load = async () => {
      setMarketCapLoading(true);
      try {
        const [kospiRes, kosdaqRes] = await Promise.all([
          fetch("/api/fsc-stock-price?limit=50&mrkt_ctg=KOSPI&order_by=mrkt_tot_amt&order_direction=desc"),
          fetch("/api/fsc-stock-price?limit=50&mrkt_ctg=KOSDAQ&order_by=mrkt_tot_amt&order_direction=desc"),
        ]);
        const kospiData = (await kospiRes.json()).data ?? [];
        const kosdaqData = (await kosdaqRes.json()).data ?? [];
        setMarketCapKospi(kospiData.map((r: { srtn_cd?: string; itms_nm?: string; clpr?: string; flt_rt?: string; mrkt_tot_amt?: string }, i: number) => ({
          rank: i + 1,
          name: r.itms_nm ?? "",
          code: r.srtn_cd ?? "",
          price: parseFloat(String(r.clpr ?? 0).replace(/,/g, "")) || 0,
          change: parseFloat(String(r.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0,
          marketCap: formatMarketCap(r.mrkt_tot_amt),
        })));
        setMarketCapKosdaq(kosdaqData.map((r: { srtn_cd?: string; itms_nm?: string; clpr?: string; flt_rt?: string; mrkt_tot_amt?: string }, i: number) => ({
          rank: i + 1,
          name: r.itms_nm ?? "",
          code: r.srtn_cd ?? "",
          price: parseFloat(String(r.clpr ?? 0).replace(/,/g, "")) || 0,
          change: parseFloat(String(r.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0,
          marketCap: formatMarketCap(r.mrkt_tot_amt),
        })));
      } catch {
        setMarketCapKospi([]);
        setMarketCapKosdaq([]);
      } finally {
        setMarketCapLoading(false);
      }
    };
    load();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "rising") return;
    const load = async () => {
      setRisingLoading(true);
      try {
        const [kospiRes, kosdaqRes] = await Promise.all([
          fetch("/api/fsc-rising-stocks?limit=50&mrkt_ctg=KOSPI"),
          fetch("/api/fsc-rising-stocks?limit=50&mrkt_ctg=KOSDAQ"),
        ]);
        const kospiData = (await kospiRes.json()).data ?? [];
        const kosdaqData = (await kosdaqRes.json()).data ?? [];
        setRisingKospi(kospiData.map((r: { rank?: number; srtn_cd?: string; itms_nm?: string; clpr?: string; flt_rt?: string }) => ({
          rank: r.rank ?? 0,
          name: r.itms_nm ?? "",
          code: r.srtn_cd ?? "",
          price: parseFloat(String(r.clpr ?? 0).replace(/,/g, "")) || 0,
          change: parseFloat(String(r.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0,
        })));
        setRisingKosdaq(kosdaqData.map((r: { rank?: number; srtn_cd?: string; itms_nm?: string; clpr?: string; flt_rt?: string }) => ({
          rank: r.rank ?? 0,
          name: r.itms_nm ?? "",
          code: r.srtn_cd ?? "",
          price: parseFloat(String(r.clpr ?? 0).replace(/,/g, "")) || 0,
          change: parseFloat(String(r.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0,
        })));
      } catch {
        setRisingKospi([]);
        setRisingKosdaq([]);
      } finally {
        setRisingLoading(false);
      }
    };
    load();
  }, [activeTab]);

  const marketCapStocks = marketCapTab === "KOSPI" ? marketCapKospi : marketCapKosdaq;
  const risingStocks = risingTab === "KOSPI" ? risingKospi : risingKosdaq;

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
                <div
                  key={stock.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedStock(toStockDetail(stock))}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedStock(toStockDetail(stock))}
                  className={styles.favoriteCard}
                >
                  <div className={styles.favoriteInner}>
                    <div className={styles.favoriteLeft}>
                      <button
                        type="button"
                        className={styles.heartBtn}
                        aria-label="관심종목"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                </div>
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
          <div className={styles.subTabList}>
            <button
              type="button"
              className={marketCapTab === "KOSPI" ? styles.subTabActive : styles.subTab}
              onClick={() => setMarketCapTab("KOSPI")}
            >
              코스피
            </button>
            <button
              type="button"
              className={marketCapTab === "KOSDAQ" ? styles.subTabActive : styles.subTab}
              onClick={() => setMarketCapTab("KOSDAQ")}
            >
              코스닥
            </button>
          </div>
          {marketCapLoading ? (
            <p className={styles.loadingText}>로딩 중...</p>
          ) : (
          <div className={styles.cardList}>
            {marketCapStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <button
                  key={`${stock.code}-${stock.rank}`}
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
          )}
        </TabsContent>

        {/* 상승종목 */}
        <TabsContent value="rising" className={styles.tabContent}>
          <div className={styles.subTabList}>
            <button
              type="button"
              className={risingTab === "KOSPI" ? styles.subTabActive : styles.subTab}
              onClick={() => setRisingTab("KOSPI")}
            >
              코스피
            </button>
            <button
              type="button"
              className={risingTab === "KOSDAQ" ? styles.subTabActive : styles.subTab}
              onClick={() => setRisingTab("KOSDAQ")}
            >
              코스닥
            </button>
          </div>
          {risingLoading ? (
            <p className={styles.loadingText}>로딩 중...</p>
          ) : (
          <StockCard
            stocks={risingStocks}
            onSelect={(s) => setSelectedStock(toStockDetail(s))}
          />
          )}
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
