"use client";

import {
  TrendingUp,
  TrendingDown,
  Heart,
  BarChart3,
  Building2,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Search } from "../components/module/Search";
import { StockCard } from "../components/module/StockCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import type { StockDetail, MarketCapStock, RisingStock } from "@/lib/types";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
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

type MarketType = "KOSPI" | "KOSDAQ";

interface SectorItem {
  name: string;
  value: number;
  change: number;
}

export default function StocksPage() {
  const { data: session } = useSession();
  const { favoriteStocks, favCodes, isLoading: favLoading } = useFavoriteStocks();

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
      const res = await addFavoriteStock({ email: session.user.email, stock_code: stock.code });
      if (res.success) {
        refreshFavorites();
        setToast({ message: res.message || "관심종목에 추가되었습니다.", type: "success" });
      } else {
        setToast({ message: res.message || "추가에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, refreshFavorites]
  );

  const handleRemoveFavorite = useCallback(
    async (code: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!session?.user?.email) return;
      const res = await removeFavoriteStock({ email: session.user.email, stock_code: code });
      if (res.success) {
        refreshFavorites();
        setToast({ message: "관심종목에서 해제되었습니다.", type: "success" });
      } else {
        setToast({ message: res.message || "해제에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, refreshFavorites]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("favorite");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRightSchedule, setSearchRightSchedule] = useState<Record<string, unknown>[]>([]);
  const [searchLnbDetail, setSearchLnbDetail] = useState<Record<string, unknown>[]>([]);
  const [searchLnbProgress, setSearchLnbProgress] = useState<Record<string, unknown>[]>([]);
  const [searchLnbInvpn, setSearchLnbInvpn] = useState<Record<string, unknown>[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  const [kospiSectors, setKospiSectors] = useState<SectorItem[]>([]);
  const [kosdaqSectors, setKosdaqSectors] = useState<SectorItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);

  const [marketCapTab, setMarketCapTab] = useState<MarketType>("KOSPI");
  const [risingTab, setRisingTab] = useState<MarketType>("KOSPI");
  const [marketCapKospi, setMarketCapKospi] = useState<MarketCapStock[]>([]);
  const [marketCapKosdaq, setMarketCapKosdaq] = useState<MarketCapStock[]>([]);
  const [risingKospi, setRisingKospi] = useState<RisingStock[]>([]);
  const [risingKosdaq, setRisingKosdaq] = useState<RisingStock[]>([]);
  const [marketCapLoading, setMarketCapLoading] = useState(false);
  const [risingLoading, setRisingLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "market") return;
    const load = async () => {
      setMarketLoading(true);
      try {
        const [krxKospi, krxKosdaq, domestic] = await Promise.all([
          fetch("/api/krx-data?data_type=kospi"),
          fetch("/api/krx-data?data_type=kosdaq"),
          fetch("/api/domestic-indices"),
        ]);
        const krxKospiJson = await krxKospi.json();
        const krxKosdaqJson = await krxKosdaq.json();
        const domesticJson = await domestic.json();

        const mapKrxToSectors = (arr: unknown[]): SectorItem[] => {
          if (!Array.isArray(arr) || arr.length === 0) return [];
          return arr.map((it) => {
            const rec = it as Record<string, unknown>;
            const name = String(rec.IDX_NM ?? rec.idx_nm ?? "");
            const val = parseFloat(String(rec.CLSPRC_IDX ?? rec.clsprc_idx ?? rec.CLPR ?? rec.clpr ?? 0).replace(/,/g, "")) || 0;
            const chg = parseFloat(String(rec.FLUC_RT ?? rec.fluc_rt ?? rec.FLT_RT ?? rec.flt_rt ?? 0).replace(/[%,+]/g, "")) || 0;
            return { name: name || "지수", value: val, change: chg };
          }).filter((s) => s.name);
        };

        const extractFirstData = (json: { data?: Array<{ data?: unknown }> }): unknown[] => {
          const list = json.data ?? [];
          const rec = list.find((r) => r.data);
          const d = rec?.data;
          return Array.isArray(d) ? d : [];
        };

        let kospiItems = mapKrxToSectors(extractFirstData(krxKospiJson));
        let kosdaqItems = mapKrxToSectors(extractFirstData(krxKosdaqJson));

        if (kospiItems.length === 0 || kosdaqItems.length === 0) {
          const data = domesticJson.data ?? [];
          const kospi = data.find((d: { name: string }) => d.name === "코스피");
          const kosdaq = data.find((d: { name: string }) => d.name === "코스닥");
          if (kospiItems.length === 0 && kospi) {
            kospiItems = [{ name: kospi.name, value: parseFloat(String(kospi.value).replace(/,/g, "")) || 0, change: parseFloat(String(kospi.percent || kospi.change).replace(/[%,+]/g, "")) || 0 }];
          }
          if (kosdaqItems.length === 0 && kosdaq) {
            kosdaqItems = [{ name: kosdaq.name, value: parseFloat(String(kosdaq.value).replace(/,/g, "")) || 0, change: parseFloat(String(kosdaq.percent || kosdaq.change).replace(/[%,+]/g, "")) || 0 }];
          }
        }

        setKospiSectors(kospiItems);
        setKosdaqSectors(kosdaqItems);
      } catch {
        setKospiSectors([]);
        setKosdaqSectors([]);
      } finally {
        setMarketLoading(false);
      }
    };
    load();
  }, [activeTab]);

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

  const handleSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearchQuery(q);
    setActiveTab("search");
  }, []);

  useEffect(() => {
    if (activeTab !== "search" || !searchQuery.trim()) return;
    const load = async () => {
      setSearchLoading(true);
      const q = searchQuery.trim();
      try {
        const [rightRes, lnbDetailRes, lnbProgressRes, lnbInvpnRes] = await Promise.all([
          fetch(`/api/right-schedule?stck_issu_cmpy_nm=${encodeURIComponent(q)}&page_no=1&num_of_rows=1000`),
          fetch(`/api/stck-lnb-detail?itms_nm=${encodeURIComponent(q)}&num_of_rows=100`),
          fetch(`/api/stck-lnb-progress?itms_nm=${encodeURIComponent(q)}&num_of_rows=100`),
          fetch(`/api/stck-lnb-invpn-detail?itms_nm=${encodeURIComponent(q)}&num_of_rows=100`),
        ]);
        const rightJson = await rightRes.json();
        const lnbDetailJson = await lnbDetailRes.json();
        const lnbProgressJson = await lnbProgressRes.json();
        const lnbInvpnJson = await lnbInvpnRes.json();
        setSearchRightSchedule(Array.isArray(rightJson.data) ? rightJson.data : []);
        setSearchLnbDetail(Array.isArray(lnbDetailJson.data) ? lnbDetailJson.data : []);
        setSearchLnbProgress(Array.isArray(lnbProgressJson.data) ? lnbProgressJson.data : []);
        setSearchLnbInvpn(Array.isArray(lnbInvpnJson.data) ? lnbInvpnJson.data : []);
      } catch {
        setSearchRightSchedule([]);
        setSearchLnbDetail([]);
        setSearchLnbProgress([]);
        setSearchLnbInvpn([]);
      } finally {
        setSearchLoading(false);
      }
    };
    load();
  }, [activeTab, searchQuery]);

  const getCellVal = (row: Record<string, unknown>, camelKey: string): string => {
    const snake = camelKey.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    return String(row[camelKey] ?? row[snake] ?? "-");
  };

  const renderSearchTable = (title: string, data: Record<string, unknown>[], keys: { key: string; label: string }[]) => {
    if (!data || data.length === 0) return null;
    return (
      <section className={styles.searchSection}>
        <h4 className={styles.searchSectionTitle}>{title}</h4>
        <div className={styles.searchTableWrap}>
          <table className={styles.searchTable}>
            <thead>
              <tr>{keys.map((k) => <th key={k.key}>{k.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((row, idx) => (
                <tr key={idx}>
                  {keys.map((k) => (
                    <td key={k.key}>{getCellVal(row, k.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className={styles.page}>
      {/* 검색 */}
      <div className={styles.searchArea}>
        <Search
          value={searchTerm}
          onChange={setSearchTerm}
          onSearch={handleSearch}
          placeholder="종목명 검색 (예: 삼성전자)"
        />
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={styles.tabList}>
          <TabsTrigger value="favorite">관심종목</TabsTrigger>
          <TabsTrigger value="search">검색결과</TabsTrigger>
          <TabsTrigger value="market">시장현황</TabsTrigger>
          <TabsTrigger value="marketcap">시가총액</TabsTrigger>
          <TabsTrigger value="rising">상승종목</TabsTrigger>
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

        {/* 검색결과 */}
        <TabsContent value="search" className={styles.tabContent}>
          {!searchQuery ? (
            <p className={styles.loadingText}>종목명을 입력하고 검색 버튼을 눌러 주세요.</p>
          ) : searchLoading ? (
            <p className={styles.loadingText}>검색 중...</p>
          ) : (
            <>
              <p className={styles.searchQueryInfo}>검색어: {searchQuery}</p>
              {renderSearchTable("주식권리일정정보", searchRightSchedule, [
                { key: "basDt", label: "기준일자" },
                { key: "stckIssuCmpyNm", label: "발행회사명" },
                { key: "rgtExertRcdNm", label: "권리행사사유" },
                { key: "rgtExertSttgDt", label: "권리행사시작일" },
                { key: "rgtExertEdDt", label: "권리행사종료일" },
              ])}
              {renderSearchTable("대차거래내역", searchLnbDetail, [
                { key: "basDt", label: "기준일자" },
                { key: "stckItmsNm", label: "종목명" },
                { key: "stckItmsCd", label: "종목코드" },
                { key: "mrktClsfNm", label: "시장구분" },
                { key: "balnStckCnt", label: "잔고주식수" },
                { key: "lnbBalAmt", label: "대차잔고금액" },
              ])}
              {renderSearchTable("대차거래추이", searchLnbProgress, [
                { key: "basDt", label: "기준일자" },
                { key: "stckItmsNm", label: "종목명" },
                { key: "stckItmsCd", label: "종목코드" },
                { key: "lnbTrVol", label: "대차거래량" },
                { key: "lnbTrAmt", label: "대차거래금액" },
                { key: "lnbBalQty", label: "대차잔고수량" },
              ])}
              {renderSearchTable("참여자별 대차거래내역", searchLnbInvpn, [
                { key: "basDt", label: "기준일자" },
                { key: "stckItmsNm", label: "종목명" },
                { key: "invpnNm", label: "참여자명" },
                { key: "invpnClsfNm", label: "참여자구분" },
                { key: "lnbCclStckCnt", label: "대차체결주식수" },
              ])}
              {!searchRightSchedule.length &&
                !searchLnbDetail.length &&
                !searchLnbProgress.length &&
                !searchLnbInvpn.length && (
                <p className={styles.loadingText}>검색 결과가 없습니다.</p>
              )}
            </>
          )}
        </TabsContent>

        {/* 시장현황 */}
        <TabsContent value="market" className={styles.tabContent}>
          {marketLoading && kospiSectors.length === 0 && kosdaqSectors.length === 0 ? (
            <p className={styles.loadingText}>로딩 중...</p>
          ) : (
            <>
              <div className={styles.sectorSection}>
                <h3 className={styles.sectorTitle}>
                  <BarChart3 className={styles.sectorIconBlue} aria-hidden />
                  코스피
                </h3>
                <div className={styles.sectorList}>
                  {kospiSectors.length === 0 ? (
                    <p className={styles.loadingText}>데이터가 없습니다.</p>
                  ) : (
                    kospiSectors.map((sector) => {
                      const isPositive = sector.change >= 0;
                      return (
                        <div key={sector.name} className={styles.sectorCard}>
                          <div>
                            <p>{sector.name}</p>
                            <p>{sector.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                          <p className={`${styles.sectorChange} ${isPositive ? styles.sectorChangeUp : styles.sectorChangeDown}`}>
                            {isPositive ? "+" : ""}
                            {sector.change.toFixed(2)}%
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className={styles.sectorSection}>
                <h3 className={styles.sectorTitle}>
                  <Building2 className={styles.sectorIconPurple} aria-hidden />
                  코스닥
                </h3>
                <div className={styles.sectorList}>
                  {kosdaqSectors.length === 0 ? (
                    <p className={styles.loadingText}>데이터가 없습니다.</p>
                  ) : (
                    kosdaqSectors.map((sector) => {
                      const isPositive = sector.change >= 0;
                      return (
                        <div key={sector.name} className={styles.sectorCard}>
                          <div>
                            <p>{sector.name}</p>
                            <p>{sector.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                          <p className={`${styles.sectorChange} ${isPositive ? styles.sectorChangeUp : styles.sectorChangeDown}`}>
                            {isPositive ? "+" : ""}
                            {sector.change.toFixed(2)}%
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
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
          onAddFavorite={handleAddFavorite}
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
