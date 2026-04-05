"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useSession } from "next-auth/react";
import { TrendingUp, TrendingDown, Heart } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
import type { StockDetail, MarketCapStock } from "@/lib/types";
import type { NaverRisingStock } from "@/lib/types/home";
import { FavoriteNews } from "@/app/components/module/news/FavoriteNews";
import styles from "@/app/supply/SupplyPage.module.css";

const LazyStockDetailModal = dynamic(
  () => import("@/app/components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

type StockTab = "favorite" | "marketcap" | "rising";
type MarketType = "KOSPI" | "KOSDAQ";

function formatMarketCap(value: string | number | undefined): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) || 0 : Number(value) || 0;
  if (num >= 1e12) return `${Math.floor(num / 1e12)}조`;
  if (num >= 1e8) return `${Math.floor(num / 1e8)}억`;
  return num >= 0 ? num.toLocaleString() : "-";
}

function formatDateLabel(dt: string | null | undefined): string {
  if (!dt) return "";
  const s = String(dt).replace(/-/g, "");
  if (s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} 기준`;
}

function toStockDetail(s: {
  name: string;
  code: string;
  price: number;
  change: number | string;
  marketCap?: string;
}): StockDetail {
  const change = typeof s.change === "string" ? parseFloat(s.change) || 0 : s.change;
  return { name: s.name, code: s.code, price: s.price, change, marketCap: s.marketCap };
}

/** 종목 흐름: 관심·시총·등락 탭 + 상세 모달 (검색 페이지 등에서 사용) */
export function StockFlowSection() {
  const { data: session } = useSession();
  const { favoriteStocks, favCodes, isLoading: favLoading } = useFavoriteStocks();
  const { addFavCode, removeFavCode } = useFavoriteStore();

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    center?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const ms = toast.center ? 3200 : 2500;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshFavorites = useCallback(() => {
    window.dispatchEvent(new Event("favoritesUpdated"));
  }, []);

  const handleAddFavorite = useCallback(
    async (stock: StockDetail) => {
      if (!session?.user?.email) {
        setToast({ message: "로그인 후 이용해 주세요.", type: "error" });
        return;
      }
      addFavCode(stock.code);
      const res = await addFavoriteStock({ email: session.user.email, stock_code: stock.code });
      if (res.success) {
        refreshFavorites();
        setToast({
          message: res.message || "관심종목에 추가했습니다.",
          type: "success",
        });
      } else {
        removeFavCode(stock.code);
        setToast({ message: res.message || "추가에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );

  const handleRemoveFavorite = useCallback(
    async (code: string, e?: MouseEvent) => {
      e?.stopPropagation();
      if (!session?.user?.email) return;
      removeFavCode(code);
      const res = await removeFavoriteStock({ email: session.user.email, stock_code: code });
      if (res.success) {
        refreshFavorites();
        setToast({ message: res.message || "해제되었습니다.", type: "success" });
      } else {
        addFavCode(code);
        setToast({ message: res.message || "해제에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );

  const [modalStock, setModalStock] = useState<StockDetail | null>(null);
  const handleCloseModal = useCallback(() => setModalStock(null), []);

  const [stockTab, setStockTab] = useState<StockTab>("favorite");
  const [marketCapTab, setMarketCapTab] = useState<MarketType>("KOSPI");
  const [marketCapKospi, setMarketCapKospi] = useState<MarketCapStock[]>([]);
  const [marketCapKosdaq, setMarketCapKosdaq] = useState<MarketCapStock[]>([]);
  const [marketCapDate, setMarketCapDate] = useState<string | null>(null);
  const [marketCapLoading, setMarketCapLoading] = useState(false);

  useEffect(() => {
    if (stockTab !== "marketcap") return;
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
        setMarketCapKospi(
          kospiData.map(
            (
              r: {
                srtn_cd?: string;
                itms_nm?: string;
                clpr?: string;
                flt_rt?: string;
                mrkt_tot_amt?: string;
              },
              i: number
            ) => ({
              rank: i + 1,
              name: r.itms_nm ?? "",
              code: r.srtn_cd ?? "",
              price: parseFloat(String(r.clpr ?? 0).replace(/,/g, "")) || 0,
              change: parseFloat(String(r.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0,
              marketCap: formatMarketCap(r.mrkt_tot_amt),
            })
          )
        );
        setMarketCapKosdaq(
          kosdaqData.map(
            (
              r: {
                srtn_cd?: string;
                itms_nm?: string;
                clpr?: string;
                flt_rt?: string;
                mrkt_tot_amt?: string;
              },
              i: number
            ) => ({
              rank: i + 1,
              name: r.itms_nm ?? "",
              code: r.srtn_cd ?? "",
              price: parseFloat(String(r.clpr ?? 0).replace(/,/g, "")) || 0,
              change: parseFloat(String(r.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0,
              marketCap: formatMarketCap(r.mrkt_tot_amt),
            })
          )
        );
      } catch {
        setMarketCapKospi([]);
        setMarketCapKosdaq([]);
      } finally {
        setMarketCapLoading(false);
      }
    };
    load();
  }, [stockTab]);

  const [risingMarket, setRisingMarket] = useState<MarketType>("KOSPI");
  const [risingKospi, setRisingKospi] = useState<NaverRisingStock[]>([]);
  const [risingKosdaq, setRisingKosdaq] = useState<NaverRisingStock[]>([]);
  const [risingCollectedTime, setRisingCollectedTime] = useState<string | null>(null);
  const [risingLoading, setRisingLoading] = useState(false);

  useEffect(() => {
    if (stockTab !== "rising") return;
    const load = async () => {
      setRisingLoading(true);
      try {
        const [kospiRes, kosdaqRes] = await Promise.all([
          fetch("/api/naver-rising-stocks?market_type=kospi&limit=100"),
          fetch("/api/naver-rising-stocks?market_type=kosdaq&limit=100"),
        ]);
        const kospiJson = await kospiRes.json();
        const kosdaqJson = await kosdaqRes.json();
        setRisingKospi(kospiJson.data ?? []);
        setRisingKosdaq(kosdaqJson.data ?? []);
        setRisingCollectedTime(kospiJson.collected_time ?? kosdaqJson.collected_time ?? null);
      } catch {
        setRisingKospi([]);
        setRisingKosdaq([]);
      } finally {
        setRisingLoading(false);
      }
    };
    load();
  }, [stockTab]);

  const marketCapStocks = marketCapTab === "KOSPI" ? marketCapKospi : marketCapKosdaq;
  const risingStocks = risingMarket === "KOSPI" ? risingKospi : risingKosdaq;

  return (
    <>
      <h1 className={styles.title}>종목 흐름</h1>
      <div className={styles.stockTabsSection}>
        <Tabs value={stockTab} onValueChange={(v) => setStockTab(v as StockTab)} variant="underline">
          <TabsList className={styles.stockTabList}>
            <TabsTrigger value="favorite" className={styles.stockTab}>
              관심종목
            </TabsTrigger>
            <TabsTrigger value="marketcap" className={styles.stockTab}>
              시총상위
            </TabsTrigger>
            <TabsTrigger value="rising" className={styles.stockTab}>
              등락률상위
            </TabsTrigger>
          </TabsList>

          <TabsContent value="favorite" className={styles.stockTabContent}>
            {!session?.user ? (
              <p className={styles.loadingText}>관심종목은 로그인 후 이용할 수 있습니다.</p>
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
                      onClick={() => setModalStock(toStockDetail(stock))}
                      onKeyDown={(e) => e.key === "Enter" && setModalStock(toStockDetail(stock))}
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
            {session?.user && favoriteStocks.length > 0 && (
              <section className={styles.favoriteNewsSection} aria-labelledby="favorite-stock-news-heading">
                <h3 id="favorite-stock-news-heading" className={styles.favoriteNewsTitle}>
                  관심종목뉴스
                </h3>
                <FavoriteNews />
              </section>
            )}
          </TabsContent>

          <TabsContent value="marketcap" className={styles.stockTabContent}>
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
                      onClick={() => setModalStock(toStockDetail(stock))}
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

          <TabsContent value="rising" className={styles.stockTabContent}>
            <div className={styles.subTabRow}>
              <div className={styles.subTabList}>
                <button
                  type="button"
                  className={risingMarket === "KOSPI" ? styles.subTabActive : styles.subTab}
                  onClick={() => setRisingMarket("KOSPI")}
                >
                  코스피
                </button>
                <button
                  type="button"
                  className={risingMarket === "KOSDAQ" ? styles.subTabActive : styles.subTab}
                  onClick={() => setRisingMarket("KOSDAQ")}
                >
                  코스닥
                </button>
              </div>
              {risingCollectedTime && (
                <span className={styles.dateLabel}>{risingCollectedTime} 기준</span>
              )}
            </div>
            {risingLoading ? (
              <p className={styles.loadingText}>로딩 중...</p>
            ) : risingStocks.length === 0 ? (
              <p className={styles.loadingText}>데이터가 없습니다.</p>
            ) : (
              <div className={styles.cardList}>
                {risingStocks.map((stock) => {
                  const pct = parseFloat(stock.change_percent.replace(/[%+,]/g, "")) || 0;
                  const isUp = pct >= 0;
                  return (
                    <div key={`${stock.stock_code}-${stock.rank}`} className={styles.marketCapCard}>
                      <div className={styles.marketCapInner}>
                        <div className={styles.rankBadgeOrange}>
                          <span>{stock.rank}</span>
                        </div>
                        <div className={styles.marketCapInfo}>
                          <h4>{stock.stock_name}</h4>
                          <p>{stock.stock_code}</p>
                        </div>
                        <div className={styles.marketCapPrice}>
                          <p>{Number(stock.current_price.replace(/,/g, "")).toLocaleString()}</p>
                          <p className={isUp ? styles.changeUp : styles.changeDown}>
                            {stock.change_percent}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {modalStock && (
        <LazyStockDetailModal
          stock={modalStock}
          onClose={handleCloseModal}
          onAddFavorite={handleAddFavorite}
          onRemoveFavorite={(s) => handleRemoveFavorite(s.code)}
          isFavorited={favCodes.has(modalStock.code)}
        />
      )}

      {toast && (
        <div
          className={[
            toast.type === "success" ? styles.toastSuccess : styles.toastError,
            toast.center ? styles.toastCenter : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
