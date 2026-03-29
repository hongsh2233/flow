"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
import { DEFAULT_BROKERS } from "@/lib/picks/defaultBrokers";
import { BROKER_STORAGE_KEY, mergeBrokerWithCatalog, openBrokerApp } from "@/lib/picks/openBroker";
import { BrokerSelectSheet, type BrokerItem } from "@/app/components/module/picks/BrokerSelectSheet";
import {
  readSavedPickPositions,
  readClearedPickHistory,
  recordSavedPickFromMarket,
  removeSavedPickWithHistory,
} from "@/lib/stocks/savedPicksStorage";
import type { StockDetail } from "@/lib/types";
import { StockTermBox } from "@/app/components/module/stock-term-box";
import {
  Briefcase,
  Star,
  ArrowRightLeft,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  MinusCircle,
  History,
} from "lucide-react";
import styles from "./MyStocks.module.css";

const LazyStockDetailModal = dynamic(
  () => import("@/app/components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

/** 저장값 YYYY-MM-DD → 표시 YY/MM/DD (예: 26/03/28) */
function formatRecommendDateDisplay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  return `${m[1].slice(2)}/${m[2]}/${m[3]}`;
}

/** ISO 시각 → KST 기준 YY/MM/DD */
function formatClearedAtDisplay(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const mo = parts.find((p) => p.type === "month")?.value ?? "";
    const da = parts.find((p) => p.type === "day")?.value ?? "";
    if (y && mo && da) return `${y}/${mo}/${da}`;
    return iso.slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

type BatchQuoteEntry = { price: number; asOf: string | null; source: string } | null;

async function fetchBatchQuotes(codes: string[]): Promise<{
  prices: Record<string, number | null>;
  quoteHint: string | null;
}> {
  const unique = [...new Set(codes)].filter(Boolean);
  if (unique.length === 0) return { prices: {}, quoteHint: null };
  try {
    const qs = new URLSearchParams({ codes: unique.join(",") });
    const res = await fetch(`/api/stock-quotes-batch?${qs.toString()}`, { cache: "no-store" });
    const j = await res.json();
    if (!j.success || !j.quotes || typeof j.quotes !== "object") {
      return { prices: Object.fromEntries(unique.map((c) => [c, null])), quoteHint: null };
    }
    const quotes = j.quotes as Record<string, BatchQuoteEntry>;
    const prices: Record<string, number | null> = {};
    for (const c of unique) {
      const row = quotes[c];
      prices[c] = row?.price ?? null;
    }
    const quoteHint: string | null =
      "수익·수익률은 지연 시세를 기준으로 한 참고용입니다. 실제 판단은 증권사 MTS 등 실시간 시세를 참고해 주세요.";
    return { prices, quoteHint };
  } catch {
    return { prices: Object.fromEntries(unique.map((c) => [c, null])), quoteHint: null };
  }
}

type SheetIntent = "change" | "go" | null;

export default function MyStocksPage() {
  const { data: session, status } = useSession();
  const { favoriteStocks, favCodes, isLoading: favLoading } = useFavoriteStocks();
  const { addFavCode, removeFavCode } = useFavoriteStore();
  const [picksTick, setPicksTick] = useState(0);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [quoteHint, setQuoteHint] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<BrokerItem[]>(DEFAULT_BROKERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetIntentRef = useRef<SheetIntent>(null);
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const savedPicks = useMemo(() => readSavedPickPositions(), [picksTick]);
  const pickHistory = useMemo(() => readClearedPickHistory(), [picksTick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
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
        recordSavedPickFromMarket(stock);
        refreshFavorites();
        setToast({ message: res.message || "관심종목에 추가되었습니다.", type: "success" });
      } else {
        removeFavCode(stock.code);
        setToast({ message: res.message || "추가에 실패했습니다.", type: "error" });
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );

  const handleRemoveFavorite = useCallback(
    async (code: string) => {
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

  useEffect(() => {
    const onSaved = () => setPicksTick((t) => t + 1);
    window.addEventListener("savedPicksUpdated", onSaved);
    return () => window.removeEventListener("savedPicksUpdated", onSaved);
  }, []);

  useEffect(() => {
    fetch("/api/picks/brokers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list = j.brokers;
        if (Array.isArray(list) && list.length > 0) setBrokers(list as BrokerItem[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const list = readSavedPickPositions();
    if (list.length === 0) {
      setPrices({});
      setQuoteHint(null);
      return;
    }
    (async () => {
      const codes = list.map((p) => p.code);
      const { prices: next, quoteHint: hint } = await fetchBatchQuotes(codes);
      if (cancelled) return;
      setPrices(next);
      setQuoteHint(hint);
    })();
    return () => {
      cancelled = true;
    };
  }, [picksTick]);

  const handleBrokerChangeClick = useCallback(() => {
    sheetIntentRef.current = "change";
    setSheetOpen(true);
  }, []);

  const handleBrokerGoClick = useCallback(() => {
    try {
      const raw = localStorage.getItem(BROKER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BrokerItem;
        if (parsed?.id) {
          void openBrokerApp(mergeBrokerWithCatalog(parsed, brokers));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    sheetIntentRef.current = "go";
    setSheetOpen(true);
  }, [brokers]);

  const handleBrokerSelect = useCallback((b: BrokerItem) => {
    try {
      localStorage.setItem(BROKER_STORAGE_KEY, JSON.stringify(b));
    } catch {
      /* ignore */
    }
    const intent = sheetIntentRef.current;
    sheetIntentRef.current = null;
    setSheetOpen(false);
    if (intent === "go") {
      void openBrokerApp(b);
    }
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
    sheetIntentRef.current = null;
  }, []);

  const handleClearSavedPick = useCallback((code: string) => {
    const snap = prices[code];
    removeSavedPickWithHistory(code, snap ?? null);
    setToast({ message: "담은 종목을 비웠습니다.", type: "success" });
  }, [prices]);

  if (status === "loading") {
    return (
      <div className="content__wrap">
        <div className={styles.loginGate}>불러오는 중...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="content__wrap">
        <div className={styles.loginGate}>
          <p>로그인 후 이용할 수 있습니다.</p>
          <Link href="/login">로그인하기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        <div className={styles.brokerRow}>
          <button type="button" className={styles.brokerBtn} onClick={handleBrokerChangeClick}>
            <ArrowRightLeft size={14} style={{ marginRight: "0.3rem", display: "inline-block", verticalAlign: "middle" }} />
            증권사 변경
          </button>
          <button type="button" className={styles.brokerBtnPrimary} onClick={handleBrokerGoClick}>
            <ExternalLink size={14} style={{ marginRight: "0.3rem", display: "inline-block", verticalAlign: "middle" }} />
            증권사 이동
          </button>
        </div>

        <div className={styles.group}>
          <div className={styles.groupTitleWrap}>
            <Briefcase className={styles.groupIcon} />
            <h2 className={styles.groupTitle}>담은 종목</h2>
          </div>
          <p className={styles.subHint}>마켓 관심 종목에서 담기에 성공한 종목이 표시됩니다. 추천금액은 담기 시점 가격입니다.</p>
          {quoteHint ? <p className={styles.subHint}>{quoteHint}</p> : null}

          {savedPicks.length === 0 ? (
            <div className={styles.emptyBox}>아직 담은 종목이 없습니다. 마켓에서 관심 담기를 해 보세요.</div>
          ) : (
            <div className={styles.groupCard}>
              {savedPicks.map((p, pIdx) => {
                const cur = prices[p.code];
                const entry = p.entryPrice;
                const profit = cur != null ? cur - entry : null;
                const rate = cur != null && entry > 0 ? ((cur - entry) / entry) * 100 : null;
                const up = profit != null && profit > 0;
                const down = profit != null && profit < 0;

                return (
                  <div key={`${p.code}-${p.savedAt}`} className={`${styles.stockRow} ${pIdx !== savedPicks.length - 1 ? styles.stockRowBordered : ""}`}>
                    <div className={styles.stockRowMain}>
                      <div className={styles.stockInfo}>
                        <div className={styles.stockName}>
                          {p.name}
                        </div>
                        <span className={styles.stockCode}>{p.code}</span>
                        <span className={styles.stockRecommendDate}>{formatRecommendDateDisplay(p.recommendDate)} 추천</span>
                      </div>
                      <div className={styles.priceInfo}>
                        <span className={styles.currentPrice}>{cur != null ? cur.toLocaleString() + "원" : "—"}</span>
                        <span className={styles.entryPrice}>기준 {entry.toLocaleString()}원</span>
                        <div className={styles.profitBadgeWrap}>
                          {profit != null && rate != null ? (
                            <span className={`${styles.profitBadge} ${up ? styles.up : down ? styles.down : ""}`}>
                              {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : <Minus size={12} />}
                              {rate > 0 ? "+" : ""}{rate.toFixed(2)}%
                            </span>
                          ) : (
                            <span className={styles.profitBadge}>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.clearPickBtn}
                      aria-label={`${p.name} 담은 종목 비우기`}
                      title="담은 종목 비우기"
                      onClick={() => handleClearSavedPick(p.code)}
                    >
                      <MinusCircle size={20} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.group}>
          <div className={styles.groupTitleWrap}>
            <History className={styles.groupIcon} />
            <h2 className={styles.groupTitle}>담기 이력</h2>
          </div>
          <p className={styles.subHint}>
            비우기 시점의 시세를 기준가로 저장합니다. 수익률은 담기 추천금 대비 비움 시점가 기준입니다.
          </p>
          {pickHistory.length === 0 ? (
            <div className={styles.emptyBox}>아직 이력이 없습니다. 담은 종목에서 비우기를 하면 여기에 표시됩니다.</div>
          ) : (
            <div className={styles.groupCard}>
              {pickHistory.map((h, hIdx) => {
                const entry = h.entryPrice;
                const clearP = h.clearPrice;
                const histRate =
                  clearP != null && entry > 0 ? ((clearP - entry) / entry) * 100 : null;
                const histUp = histRate != null && histRate > 0;
                const histDown = histRate != null && histRate < 0;

                return (
                  <div
                    key={`${h.code}-${h.clearedAt}`}
                    className={`${styles.stockRow} ${hIdx !== pickHistory.length - 1 ? styles.stockRowBordered : ""}`}
                  >
                    <div className={styles.stockInfo}>
                      <div className={styles.stockName}>{h.name}</div>
                      <span className={styles.stockCode}>{h.code}</span>
                      <span className={styles.stockRecommendDate}>{formatRecommendDateDisplay(h.recommendDate)} 추천</span>
                      <span className={styles.historyClearedMeta}>{formatClearedAtDisplay(h.clearedAt)} 비움</span>
                    </div>
                    <div className={styles.priceInfo}>
                      <span className={styles.entryPrice}>담기 {entry.toLocaleString()}원</span>
                      <span className={styles.historyClearPrice}>
                        비움 기준 {clearP != null ? `${clearP.toLocaleString()}원` : "—"}
                      </span>
                      <div className={styles.profitBadgeWrap}>
                        {histRate != null ? (
                          <span className={`${styles.profitBadge} ${histUp ? styles.up : histDown ? styles.down : ""}`}>
                            {histUp ? <TrendingUp size={12} /> : histDown ? <TrendingDown size={12} /> : <Minus size={12} />}
                            {histRate > 0 ? "+" : ""}
                            {histRate.toFixed(2)}%
                          </span>
                        ) : (
                          <span className={styles.profitBadge}>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.group}>
          <div className={styles.groupTitleWrap}>
            <Star className={styles.groupIcon} style={{ fill: "currentColor" }} />
            <h2 className={styles.groupTitle}>관심종목</h2>
          </div>
          {favLoading && favoriteStocks.length === 0 ? (
            <div className={styles.emptyBox}>관심종목을 불러오는 중...</div>
          ) : favoriteStocks.length === 0 ? (
            <div className={styles.emptyBox}>등록된 관심종목이 없습니다.</div>
          ) : (
            <div className={styles.favGrid}>
              {favoriteStocks.map((stock) => {
                const isUp = stock.change > 0;
                const isDown = stock.change < 0;
                return (
                  <button
                    key={stock.id}
                    type="button"
                    className={styles.favCard}
                    onClick={() =>
                      setSelectedStock({
                        name: stock.name,
                        code: stock.code,
                        price: stock.price,
                        change: stock.change,
                      })
                    }
                  >
                    <div className={styles.favCardHeader}>
                      <div className={styles.favNameWrap}>
                        <h3 className={styles.favName}>{stock.name}</h3>
                        <p className={styles.favCode}>{stock.code}</p>
                      </div>
                      <div className={styles.favIconWrap}>
                        <Star size={16} style={{ fill: "currentColor" }} />
                      </div>
                    </div>
                    <div className={styles.favPriceWrap}>
                      <span className={styles.favPrice}>{stock.price.toLocaleString()}</span>
                      <span className={`${styles.favChange} ${isUp ? styles.up : isDown ? styles.down : ""}`}>
                        {isUp ? <TrendingUp size={12} style={{ marginRight: '2px', verticalAlign: 'middle', display: 'inline-block' }} /> : 
                         isDown ? <TrendingDown size={12} style={{ marginRight: '2px', verticalAlign: 'middle', display: 'inline-block' }} /> : null}
                        {isUp ? "+" : ""}{stock.change}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BrokerSelectSheet
        open={sheetOpen}
        brokers={brokers}
        onClose={handleCloseSheet}
        onSelect={handleBrokerSelect}
      />

      {selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onAddFavorite={handleAddFavorite}
          onRemoveFavorite={(s) => void handleRemoveFavorite(s.code)}
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

      <StockTermBox wrapperStyle={{ marginTop: "1.5rem" }} />
    </div>
  );
}
