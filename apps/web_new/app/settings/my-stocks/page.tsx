"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
import { DEFAULT_BROKERS } from "@/lib/picks/defaultBrokers";
import { BROKER_STORAGE_KEY, openBrokerApp } from "@/lib/picks/openBroker";
import { BrokerSelectSheet, type BrokerItem } from "@/app/components/module/picks/BrokerSelectSheet";
import { readSavedPickPositions, recordSavedPickFromMarket } from "@/lib/stocks/savedPicksStorage";
import type { StockDetail } from "@/lib/types";
import { StockTermBox } from "@/app/components/module/stock-term-box";
import styles from "./MyStocks.module.css";

const LazyStockDetailModal = dynamic(
  () => import("@/app/components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);

async function fetchCurrentPrice(code: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/fsc-stock-price?srtn_cd=${encodeURIComponent(code)}&limit=5`, {
      cache: "no-store",
    });
    const j = await res.json();
    const row = Array.isArray(j.data) ? j.data[0] : null;
    if (!row?.clpr) return null;
    const n = parseFloat(String(row.clpr).replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

type SheetIntent = "change" | "go" | null;

export default function MyStocksPage() {
  const { data: session, status } = useSession();
  const { favoriteStocks, favCodes, isLoading: favLoading } = useFavoriteStocks();
  const { addFavCode, removeFavCode } = useFavoriteStore();
  const [picksTick, setPicksTick] = useState(0);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [brokers, setBrokers] = useState<BrokerItem[]>(DEFAULT_BROKERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetIntentRef = useRef<SheetIntent>(null);
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const savedPicks = useMemo(() => readSavedPickPositions(), [picksTick]);

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
      return;
    }
    (async () => {
      const entries = await Promise.all(
        list.map(async (p) => {
          const cur = await fetchCurrentPrice(p.code);
          return [p.code, cur] as const;
        })
      );
      if (cancelled) return;
      setPrices(Object.fromEntries(entries));
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
        const b = JSON.parse(raw) as BrokerItem;
        if (b?.id) {
          void openBrokerApp(b);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    sheetIntentRef.current = "go";
    setSheetOpen(true);
  }, []);

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
            증권사 변경
          </button>
          <button type="button" className={styles.brokerBtnPrimary} onClick={handleBrokerGoClick}>
            증권사 이동
          </button>
        </div>

        <h2 className={styles.sectionTitle}>담은 종목</h2>
        <p className={styles.subHint}>마켓 관심 종목에서 담기에 성공한 종목이 표시됩니다. 추천금액은 담기 시점 가격입니다.</p>

        {savedPicks.length === 0 ? (
          <div className={styles.emptyBox}>아직 담은 종목이 없습니다. 마켓에서 관심 담기를 해 보세요.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">종목</th>
                  <th scope="col">추천일</th>
                  <th scope="col">추천금액</th>
                  <th scope="col">현재금액</th>
                  <th scope="col">수익</th>
                  <th scope="col">수익률</th>
                </tr>
              </thead>
              <tbody>
                {savedPicks.map((p) => {
                  const cur = prices[p.code];
                  const entry = p.entryPrice;
                  const profit = cur != null ? cur - entry : null;
                  const rate = cur != null && entry > 0 ? ((cur - entry) / entry) * 100 : null;
                  const up = profit != null && profit > 0;
                  const down = profit != null && profit < 0;

                  return (
                    <tr key={`${p.code}-${p.savedAt}`}>
                      <td className={styles.left}>
                        <span className={styles.nameStrong}>{p.name}</span>
                        <span className={styles.codeMuted}>({p.code})</span>
                      </td>
                      <td>{p.recommendDate}</td>
                      <td>{entry.toLocaleString()}</td>
                      <td>{cur != null ? cur.toLocaleString() : "—"}</td>
                      <td className={up ? styles.up : down ? styles.down : undefined}>
                        {profit != null ? profit.toLocaleString() : "—"}
                      </td>
                      <td className={up ? styles.up : down ? styles.down : undefined}>
                        {rate != null ? `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className={styles.sectionTitle}>관심종목</h2>
        {favLoading && favoriteStocks.length === 0 ? (
          <div className={styles.emptyBox}>관심종목을 불러오는 중...</div>
        ) : favoriteStocks.length === 0 ? (
          <div className={styles.emptyBox}>등록된 관심종목이 없습니다.</div>
        ) : (
          <div className={styles.favGrid}>
            {favoriteStocks.map((stock) => {
              const isUp = stock.change >= 0;
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
                  <p className={styles.favName}>{stock.name}</p>
                  <p className={styles.favCode}>{stock.code}</p>
                  <div className={`${styles.favPrice} ${isUp ? styles.up : styles.down}`}>
                    {stock.price.toLocaleString()} · {isUp ? "+" : ""}
                    {stock.change}%
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
