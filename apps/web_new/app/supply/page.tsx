"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { RandomAffiliateCard } from "../components/module/affiliate/RandomAffiliateCard";
import { MarketPicksSection } from "../components/module/picks/MarketPicksSection";
import { InvestorTrendChart } from "../components/module/home/InvestorTrendChart";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
import { readSavedPickPositions, recordSavedPickFromMarket } from "@/lib/stocks/savedPicksStorage";
import type { ScreeningPickMeta } from "@/lib/picks/screeningPick";
import type { StockDetail } from "@/lib/types";
import { AdZoneSlot } from "../components/module/AdZoneSlot";
import { shouldShowAdZoneB_vip } from "@/lib/affiliate/adZoneB";
import { StockTermBox } from "../components/module/stock-term-box";
import { RandomMasterQuote } from "../components/module/random-master-quote";
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
  // 콤마·+·%·▲ 제거 후 parseFloat (소수 등락률 0.67% → 0.67 처리)
  const s = String(val).replace(/,/g, "").replace(/[+%▲]/g, "").trim();
  if (!s || s === "-" || s === "▼") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function getSupplyCellClass(cell: string, colIndex: number): string | undefined {
  if (colIndex === 0) return undefined;
  const trimmed = String(cell).trim();
  // 네이버는 -/+ 외에 ▼/▲ 심볼도 사용
  if (trimmed.startsWith("-") || trimmed.startsWith("▼")) return styles.down;
  if (trimmed.startsWith("+") || trimmed.startsWith("▲")) return styles.up;
  const num = parseSupplyNum(cell);
  if (num !== null) return num > 0 ? styles.up : num < 0 ? styles.down : undefined;
  return undefined;
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

// ─── 메인 페이지 (variant: supply=수급, stocks=추천·관심·시총·등락) ───────────────
export function MarketSupplyPage({ variant }: { variant: "supply" | "stocks" }) {
  const { data: session, status } = useSession();
  const { favCodes } = useFavoriteStocks();
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

  const [pickedCodes, setPickedCodes] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (variant !== "stocks") return;
    const sync = () => {
      const codes = new Set(readSavedPickPositions().map((p) => p.code));
      setPickedCodes(codes);
    };
    sync();
    window.addEventListener("savedPicksUpdated", sync);
    return () => window.removeEventListener("savedPicksUpdated", sync);
  }, [variant]);

  /** 추천종목 표 담기: 무료 순위 초과 시 포인트 차감 후 로컬 내 종목 시세에 기록 */
  const handlePickFromRecommend = useCallback(
    async (stock: StockDetail, meta: ScreeningPickMeta) => {
      if (!session?.user?.email) {
        setToast({ message: "로그인 후 이용해 주세요.", type: "error" });
        return;
      }
      if (!meta.screeningDate) {
        setToast({
          message: "스크리닝 날짜를 불러온 뒤 다시 시도해 주세요.",
          type: "error",
          center: true,
        });
        return;
      }
      const res = await fetch("/api/auth/member/screening-pick/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_code: stock.code,
          rank: meta.rank,
          screening_date: meta.screeningDate,
          screening_type: meta.screeningType,
        }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: unknown;
        point_balance?: number;
      };
      if (!res.ok) {
        const d = data.detail;
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? d
                  .map((x: { msg?: string }) => x?.msg)
                  .filter(Boolean)
                  .join(", ")
              : "포인트 차감에 실패했습니다.";
        setToast({ message: msg, type: "error", center: true });
        return;
      }
      recordSavedPickFromMarket(stock);
      setPickedCodes((prev) => new Set(prev).add(stock.code));
      setToast({
        message: "종목을 담았습니다.\n설정 > 내 종목 시세에서 보실 수 있습니다.",
        type: "success",
        center: true,
      });
      if (typeof data.point_balance === "number") {
        window.dispatchEvent(
          new CustomEvent("memberPointsUpdated", { detail: { balance: data.point_balance } })
        );
      }
    },
    [session]
  );

  const handleAddFavorite = useCallback(async (stock: StockDetail) => {
    if (!session?.user?.email) {
      setToast({ message: "로그인 후 이용해 주세요.", type: "error" });
      return;
    }
    addFavCode(stock.code); // optimistic
    const res = await addFavoriteStock({ email: session.user.email, stock_code: stock.code });
    if (res.success) {
      refreshFavorites();
      setToast({
        message: res.message || "관심종목에 추가했습니다.",
        type: "success",
      });
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
    if (variant !== "supply") return;
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
  }, [mainTab, market, variant]);

  const currentInvestor = investorData[market];
  const currentProgram = programData[market];
  const currentDeal = dealData[market];

  return (
    <div className={styles.page}>
      <div className={styles.pageTopShelf}>
        <StockTermBox wrapperStyle={{ margin: "0 0 0.75rem" }} />
        <RandomMasterQuote />
      </div>

      {variant === "stocks" && (
        <MarketPicksSection
          onSelectStock={setSelectedStock}
          onPickStock={handlePickFromRecommend}
          pickedCodes={pickedCodes}
        />
      )}

      {variant === "supply" && <InvestorTrendChart defaultMarket="kospi" variant="main" />}

      <div className={styles.affiliateSlot} aria-label="제휴 상품">
        <RandomAffiliateCard />
      </div>

      {variant === "supply" && (
        <>
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
                    <InvestorTable data={currentInvestor.data} />
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
                    <ProgramTable data={currentProgram.data} />
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
      {shouldShowAdZoneB_vip(session, status) && <AdZoneSlot zone="B5" />}
        </>
      )}

      {variant === "stocks" && selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={handleClose}
          onAddFavorite={handleAddFavorite}
          onRemoveFavorite={(s) => handleRemoveFavorite(s.code)}
          isFavorited={favCodes.has(selectedStock.code)}
        />
      )}

      {variant === "stocks" && toast && (
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
    </div>
  );
}

export default function SupplyPage() {
  return <MarketSupplyPage variant="supply" />;
}
