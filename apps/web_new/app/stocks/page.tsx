"use client";

import {
  TrendingUp,
  TrendingDown,
  Heart,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search } from "../components/module/Search";
import { StockTermBox } from "../components/module/stock-term-box";
import { InvestorTrendChart } from "../components/module/home/InvestorTrendChart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import type { StockDetail, MarketCapStock } from "@/lib/types";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
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

function formatDateLabel(dt: string | null | undefined): string {
  if (!dt) return "";
  const s = String(dt).replace(/-/g, "");
  if (s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} 기준`;
}

type MarketType = "KOSPI" | "KOSDAQ";

export default function StocksPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { favoriteStocks, favCodes, isLoading: favLoading } = useFavoriteStocks();
  const { addFavCode, removeFavCode } = useFavoriteStore();

  const refreshFavorites = useCallback(() => {
    window.dispatchEvent(new Event("favoritesUpdated"));
  }, []);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAddFavorite = useCallback(
    async (stock: StockDetail) => {
      if (!session?.user?.email) {
        setToast({ message: "로그인 후 이용해 주세요.", type: "error" });
        return;
      }
      addFavCode(stock.code); // optimistic
      const res = await addFavoriteStock({ email: session.user.email, stock_code: stock.code });
      if (res.success) {
        refreshFavorites();
        setToast({ message: res.message || "관심종목에 추가되었습니다.", type: "success" });
      } else {
        removeFavCode(stock.code); // rollback
        setToast({ message: res.message || "추가에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );

  const handleRemoveFavorite = useCallback(
    async (code: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!session?.user?.email) return;
      removeFavCode(code); // optimistic
      const res = await removeFavoriteStock({ email: session.user.email, stock_code: code });
      if (res.success) {
        refreshFavorites();
        setToast({ message: res.message || "해제되었습니다.", type: "success" });
      } else {
        addFavCode(code); // rollback
        setToast({ message: res.message || "해제에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("favorite");
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  const [marketCapTab, setMarketCapTab] = useState<MarketType>("KOSPI");
  const [marketCapKospi, setMarketCapKospi] = useState<MarketCapStock[]>([]);
  const [marketCapKosdaq, setMarketCapKosdaq] = useState<MarketCapStock[]>([]);
  const [marketCapDate, setMarketCapDate] = useState<string | null>(null);
  const [marketCapLoading, setMarketCapLoading] = useState(false);


  useEffect(() => {
    if (activeTab !== "marketcap") return;
    const load = async () => {
      setMarketCapLoading(true);
      try {
        const [kospiRes, kosdaqRes] = await Promise.all([
          fetch("/api/fsc-stock-price?limit=50&mrkt_ctg=KOSPI&order_by=mrkt_tot_amt&order_direction=desc"),
          fetch("/api/fsc-stock-price?limit=50&mrkt_ctg=KOSDAQ&order_by=mrkt_tot_amt&order_direction=desc"),
        ]);
        const kospiJson = await kospiRes.json();
        const kosdaqData = (await kosdaqRes.json()).data ?? [];
        const kospiData = kospiJson.data ?? [];
        if (kospiJson.bas_dt) setMarketCapDate(kospiJson.bas_dt);
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

  const marketCapStocks = marketCapTab === "KOSPI" ? marketCapKospi : marketCapKosdaq;
  const handleSearch = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      router.push(`/stocks/search?q=${encodeURIComponent(q)}`);
    },
    [router]
  );

  return (
    <div className={styles.page}>
      <StockTermBox wrapperStyle={{ margin: "0 1rem 1.5rem" }} />
      {/* 검색 */}
      <div className={styles.searchArea}>
        <Search
          value={searchTerm}
          onChange={setSearchTerm}
          onSearch={handleSearch}
          placeholder="종목명 검색 (예: 삼성전자)"
        />
      </div>

      {/* 투자자별 매매동향 차트 */}
      <InvestorTrendChart variant="stocks" />

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
        <TabsList className={styles.tabList}>
          <TabsTrigger value="favorite" className={styles.tab}>관심종목</TabsTrigger>
          <TabsTrigger value="marketcap" className={styles.tab}>시총상위</TabsTrigger>
        </TabsList>

        {/* 관심종목 */}
        <TabsContent value="favorite" className={styles.tabContent}>
          {!session?.user ? (
            <p className={styles.loadingText}>
              관심종목은 로그인 후 이용할 수 있습니다.
            </p>
          ) : favLoading && favoriteStocks.length === 0 ? (
            <p className={styles.loadingText}>로딩 중...</p>
          ) : favoriteStocks.length === 0 ? (
            <p className={styles.loadingText}>등록된 관심종목이 없습니다.</p>
          ) : (
          <div className={styles.cardList}>
            {favoriteStocks.map((stock) => {
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
                        aria-label="관심종목 해제"
                        onClick={(e) => handleRemoveFavorite(stock.code, e)}
                      >
                        <Heart className={styles.heart} aria-hidden fill="currentColor" />
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
          )}
        </TabsContent>

        {/* 시총상위 */}
        <TabsContent value="marketcap" className={styles.tabContent}>
          <div className={styles.subTabRow}>
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
            {marketCapDate && (
              <span className={styles.dateLabel}>{formatDateLabel(marketCapDate)}</span>
            )}
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

      </Tabs>

      {/* 모달 */}
      {selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={handleClose}
          onAddFavorite={handleAddFavorite}
          onRemoveFavorite={(s) => handleRemoveFavorite(s.code)}
          isFavorited={favCodes.has(selectedStock.code)}
        />
      )}

      {toast && (
        <div
          className={toast.type === "success" ? styles.toastSuccess : styles.toastError}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
