"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, Heart } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Search } from "../components/module/Search";
import { SupplySummaryCard } from "../components/module/home/SupplySummaryCard";
import { RandomAffiliateCard } from "../components/module/affiliate/RandomAffiliateCard";
import { InvestorTrendChart } from "../components/module/home/InvestorTrendChart";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
import type { StockDetail, MarketCapStock, RisingStock } from "@/lib/types";
import styles from "./SupplyPage.module.css";

const LazyStockDetailModal = dynamic(
  () => import("../components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

// ─── 수급 테이블 타입 ────────────────────────────────────────────────────────
interface TableData {
  headers: string[];
  rows: string[][];
}

interface SupplyResponse {
  success: boolean;
  data: TableData | null;
  bizdate: string | null;
  collected_time?: string | null;
}

type Market = "kospi" | "kosdaq";
type MainTab = "investor" | "deal" | "program";
type StockTab = "favorite" | "marketcap" | "rising";
type MarketType = "KOSPI" | "KOSDAQ";

// ─── 수급 API ────────────────────────────────────────────────────────────────
async function fetchTable(params: URLSearchParams): Promise<SupplyResponse> {
  async function request(p: URLSearchParams): Promise<SupplyResponse> {
    const res = await fetch(`/api/naver-supply?${p.toString()}`, { cache: "no-store" });
    if (!res.ok) return { success: false, data: null, bizdate: null };
    return res.json();
  }
  const primary = await request(params);
  const market = params.get("market");
  if ((primary.success && primary.data) || !market || market === "all") return primary;
  const fallbackParams = new URLSearchParams(params);
  fallbackParams.set("market", "all");
  return request(fallbackParams);
}

// ─── 셀 색상 ─────────────────────────────────────────────────────────────────
function parseSupplyNum(val: string): number | null {
  const s = String(val).replace(/,/g, "").replace(/\+/g, "").trim();
  if (!s || s === "-") return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function getSupplyCellClass(cell: string, colIndex: number): string | undefined {
  if (colIndex === 0) return undefined;
  const trimmed = String(cell).trim();
  if (trimmed.startsWith("-")) return styles.down;
  if (trimmed.startsWith("+")) return styles.up;
  const num = parseSupplyNum(cell);
  if (num !== null) return num > 0 ? styles.up : num < 0 ? styles.down : undefined;
  return undefined;
}

// ─── 시총상위 포맷 ──────────────────────────────────────────────────────────
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

function toStockDetail(s: { name: string; code: string; price: number; change: number | string; marketCap?: string }): StockDetail {
  const change = typeof s.change === "string" ? parseFloat(s.change) || 0 : s.change;
  return { name: s.name, code: s.code, price: s.price, change, marketCap: s.marketCap };
}

// ─── 수급 테이블 컴포넌트 ────────────────────────────────────────────────────
function Table({ data }: { data: TableData }) {
  if (!data.rows.length) return <p className={styles.empty}>데이터가 없습니다.</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {data.headers.map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, i) => (
                <td key={i} className={getSupplyCellClass(cell, i)}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgramTable({ data }: { data: TableData }) {
  if (!data.rows.length) return <p className={styles.empty}>데이터가 없습니다.</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.investorHeadMain}>
            <th rowSpan={2} className={styles.investorHeadFirst}>날짜</th>
            <th colSpan={3} className={styles.investorHeadGroup}>차익거래</th>
            <th colSpan={3} className={styles.investorHeadGroup}>비차익거래</th>
            <th colSpan={3} className={styles.investorHeadGroup}>전체</th>
          </tr>
          <tr className={styles.investorHeadSub}>
            {["매수","매도","순매수","매수","매도","순매수","매수","매도","순매수"].map((h, i) => (
              <th key={i} className={styles.investorHeadSubCell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, i) => <td key={i} className={getSupplyCellClass(cell, i)}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestorTable({ data }: { data: TableData }) {
  if (!data.rows.length) return <p className={styles.empty}>데이터가 없습니다.</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.investorHeadMain}>
            <th rowSpan={2} className={styles.investorHeadFirst}>날짜</th>
            <th rowSpan={2}>개인</th>
            <th rowSpan={2}>외국인</th>
            <th rowSpan={2}>기관계</th>
            <th colSpan={6} className={styles.investorHeadGroup}>기관</th>
            <th rowSpan={2}>기타법인</th>
          </tr>
          <tr className={styles.investorHeadSub}>
            {["금융투자","보험","투신(사모)","은행","기타금융기관","연기금등"].map((h) => (
              <th key={h} className={styles.investorHeadSubCell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, i) => <td key={i} className={getSupplyCellClass(cell, i)}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMeta(bizdate: string | null | undefined, collectedTime: string | null | undefined): string {
  const date = bizdate ?? "-";
  const time = collectedTime ? `${collectedTime} 기준` : "-";
  return `기준일: ${date} / ${time}`;
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function SupplyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { favoriteStocks, favCodes, isLoading: favLoading } = useFavoriteStocks();
  const { addFavCode, removeFavCode } = useFavoriteStore();

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshFavorites = useCallback(() => {
    window.dispatchEvent(new Event("favoritesUpdated"));
  }, []);

  const handleAddFavorite = useCallback(async (stock: StockDetail) => {
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
  }, [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]);

  const handleRemoveFavorite = useCallback(async (code: string, e?: React.MouseEvent) => {
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
  }, [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]);

  // ── 검색 ──
  const [searchTerm, setSearchTerm] = useState("");
  const handleSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    router.push(`/stocks/search?q=${encodeURIComponent(q)}`);
  }, [router]);

  // ── 선택된 종목 (모달) ──
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  // ── 수급 동향 상태 ──
  const [mainTab, setMainTab] = useState<MainTab>("investor");
  const [market, setMarket] = useState<Market>("kospi");

  const [investorData, setInvestorData] = useState<Record<Market, SupplyResponse | null>>({ kospi: null, kosdaq: null });
  const [programData, setProgramData] = useState<Record<Market, SupplyResponse | null>>({ kospi: null, kosdaq: null });
  const [dealData, setDealData] = useState<Record<Market, Record<string, SupplyResponse | null>>>({
    kospi: { foreign_buy: null, foreign_sell: null, inst_buy: null, inst_sell: null },
    kosdaq: { foreign_buy: null, foreign_sell: null, inst_buy: null, inst_sell: null },
  });
  const [supplyLoading, setSupplyLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const key = `${mainTab}-${market}`;
    if (fetchedRef.current.has(key)) return;

    async function load() {
      setSupplyLoading(true);
      try {
        if (mainTab === "investor") {
          fetchedRef.current.add(key);
          const params = new URLSearchParams({ data_type: "investor_day", market });
          const json = await fetchTable(params);
          setInvestorData((prev) => ({ ...prev, [market]: json }));
        } else if (mainTab === "program") {
          fetchedRef.current.add(key);
          const params = new URLSearchParams({ data_type: "program_day", market });
          const json = await fetchTable(params);
          setProgramData((prev) => ({ ...prev, [market]: json }));
        } else if (mainTab === "deal") {
          fetchedRef.current.add(key);
          const subKeys = ["foreign_buy", "foreign_sell", "inst_buy", "inst_sell"] as const;
          const results: Record<string, SupplyResponse | null> = {};
          await Promise.all(subKeys.map(async (subKey) => {
            const params = new URLSearchParams({ data_type: "deal_rank", market, sub_key: subKey });
            results[subKey] = await fetchTable(params);
          }));
          setDealData((prev) => ({ ...prev, [market]: results }));
        }
      } catch (e) {
        console.error("수급 데이터 로드 실패:", e);
        fetchedRef.current.delete(key);
      } finally {
        setSupplyLoading(false);
      }
    }
    load();
  }, [mainTab, market]);

  // ── 시총상위 상태 ──
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
  }, [stockTab]);

  // ── 등락률상위 상태 ──
  const [risingMarket, setRisingMarket] = useState<MarketType>("KOSPI");
  const [risingKospi, setRisingKospi] = useState<RisingStock[]>([]);
  const [risingKosdaq, setRisingKosdaq] = useState<RisingStock[]>([]);
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

  const currentInvestor = investorData[market];
  const currentProgram = programData[market];
  const currentDeal = dealData[market];
  const marketCapStocks = marketCapTab === "KOSPI" ? marketCapKospi : marketCapKosdaq;
  const risingStocks = risingMarket === "KOSPI" ? risingKospi : risingKosdaq;

  return (
    <div className={styles.page}>
      {/* 0. 수급 요약 카드 (최상단) — 숫자는 최신 수집분, 문구는 DB의 Gemini 요약 */}
      <SupplySummaryCard />

      {/* 1. 검색 */}
      <div className={styles.searchArea}>
        <Search
          value={searchTerm}
          onChange={setSearchTerm}
          onSearch={handleSearch}
          placeholder="종목명 검색 (예: 삼성전자)"
        />
      </div>

      {/* 2. 수급 차트 (더보기 링크 숨김) */}
      <InvestorTrendChart variant="stocks" hideMoreLink />

      <div className={styles.affiliateSlot} aria-label="제휴 상품">
        <RandomAffiliateCard />
      </div>

      {/* 3. 수급 동향 탭 */}
      <h1 className={styles.title}>수급 동향</h1>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)} variant="underline">
        <TabsList style={{ gap: "0.1rem", display: "flex", paddingBottom: "0.1rem" }}>
          <TabsTrigger value="investor">투자자별 매매동향 (일자별)</TabsTrigger>
          <TabsTrigger value="deal">수급 순위</TabsTrigger>
          <TabsTrigger value="program">프로그램 매매 (일자별)</TabsTrigger>
        </TabsList>

        <div className={styles.marketTabs}>
          <Tabs value={market} onValueChange={(v) => setMarket(v as Market)} variant="pill">
            <TabsList>
              <TabsTrigger value="kospi">코스피</TabsTrigger>
              <TabsTrigger value="kosdaq">코스닥</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {supplyLoading && <p className={styles.loading}>불러오는 중...</p>}

        <TabsContent value="investor">
          {!supplyLoading && (
            <>
              {currentInvestor ? (
                <>
                  <p className={styles.meta}>{formatMeta(currentInvestor.bizdate, currentInvestor.collected_time)}</p>
                  {currentInvestor.success && currentInvestor.data ? (
                    <Table data={currentInvestor.data} />
                  ) : (
                    <p className={styles.empty}>데이터가 없습니다.</p>
                  )}
                </>
              ) : (
                <p className={styles.empty}>데이터가 없습니다.</p>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="deal">
          {!supplyLoading && (
            <div className={styles.dealGrid}>
              {(["foreign_buy", "foreign_sell", "inst_buy", "inst_sell"] as const).map((key) => {
                const entry = currentDeal[key];
                const titleMap: Record<string, string> = {
                  foreign_buy: "외국인 순매수",
                  foreign_sell: "외국인 순매도",
                  inst_buy: "기관 순매수",
                  inst_sell: "기관 순매도",
                };
                return (
                  <div key={key} className={styles.card}>
                    <div className={styles.cardHeader}>{titleMap[key]}</div>
                    {!entry ? (
                      <p className={styles.emptySmall}>데이터가 없습니다.</p>
                    ) : entry.success && entry.data ? (
                      <>
                        <p className={styles.meta}>{formatMeta(entry.bizdate, entry.collected_time)}</p>
                        <Table data={entry.data} />
                      </>
                    ) : (
                      <p className={styles.emptySmall}>데이터가 없습니다.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="program">
          {!supplyLoading && (
            <>
              {currentProgram ? (
                <>
                  <p className={styles.meta}>{formatMeta(currentProgram.bizdate, currentProgram.collected_time)}</p>
                  {currentProgram.success && currentProgram.data ? (
                    <Table data={currentProgram.data} />
                  ) : (
                    <p className={styles.empty}>데이터가 없습니다.</p>
                  )}
                </>
              ) : (
                <p className={styles.empty}>데이터가 없습니다.</p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 4. 관심종목 / 시총상위 / 등락률상위 탭 */}
      <div className={styles.stockTabsSection}>
        <Tabs value={stockTab} onValueChange={(v) => setStockTab(v as StockTab)} variant="underline">
          <TabsList className={styles.stockTabList}>
            <TabsTrigger value="favorite" className={styles.stockTab}>관심종목</TabsTrigger>
            <TabsTrigger value="marketcap" className={styles.stockTab}>시총상위</TabsTrigger>
            <TabsTrigger value="rising" className={styles.stockTab}>등락률상위</TabsTrigger>
          </TabsList>

          {/* 관심종목 */}
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
                              {isPositive ? "+" : ""}{stock.change}%
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
                            {isPositive ? "+" : ""}{stock.change}%
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

          {/* 등락률상위 */}
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
