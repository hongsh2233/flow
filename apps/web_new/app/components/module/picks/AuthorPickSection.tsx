"use client";

import { useCallback, useEffect, useState } from "react";
import type { PicksGradeTier } from "@/lib/picks/gradeTier";
import type { StockDetail } from "@/lib/types";
import styles from "./Picks.module.css";

type PickRow = {
  id: number;
  stock_code: string;
  stock_name: string;
  entry_price: number;
  entry_date: string;
  is_closed?: boolean;
};

type Props = {
  onSelectStock?: (s: StockDetail) => void;
};

export function AuthorPickSection({ onSelectStock }: Props) {
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [tier, setTier] = useState<PicksGradeTier>("guest");
  const [loading, setLoading] = useState(true);

  const loadPrices = useCallback(async (codes: string[]) => {
    const next: Record<string, number> = {};
    await Promise.all(
      codes.map(async (code) => {
        if (!code || code === "***") return;
        try {
          const res = await fetch(`/api/fsc-stock-price?srtn_cd=${encodeURIComponent(code)}&limit=5`, {
            cache: "no-store",
          });
          const j = await res.json();
          const row = Array.isArray(j.data) ? j.data[0] : null;
          const clpr = row?.clpr ?? row?.CLPR;
          const n = parseFloat(String(clpr ?? "").replace(/,/g, ""));
          if (!isNaN(n)) next[code] = n;
        } catch {
          /* skip */
        }
      })
    );
    setPrices((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/picks/stock-picks", { cache: "no-store", credentials: "same-origin" });
        const j = await res.json();
        if (cancelled) return;
        const list = Array.isArray(j.picks) ? j.picks : [];
        setPicks(list);
        if (j.tier === "family" || j.tier === "member_limited" || j.tier === "guest") {
          setTier(j.tier);
        }
        const codes = list.map((p: PickRow) => p.stock_code).filter(Boolean);
        await loadPrices(codes);
      } catch {
        if (!cancelled) setPicks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPrices]);

  return (
    <section aria-labelledby="author-picks-heading">
      <h2 id="author-picks-heading" className={styles.sectionTitle}>
        작가 픽 · 모의 매매
      </h2>
      <p className={styles.meta}>※ 실제 투자 결과와 다를 수 있습니다.</p>
      {loading ? (
        <p className={styles.meta}>불러오는 중...</p>
      ) : picks.length === 0 ? (
        <p className={styles.empty}>등록된 작가 픽이 없습니다.</p>
      ) : (
        picks.map((p) => {
          const cur = prices[p.stock_code];
          const entry = p.entry_price;
          const pct =
            cur != null && entry > 0 ? (((cur - entry) / entry) * 100).toFixed(2) : null;
          const isUp = pct != null && parseFloat(pct) >= 0;
          const blind = p.stock_name === "***";
          const detail: StockDetail | null =
            !blind && p.stock_code && p.stock_name
              ? {
                  name: p.stock_name,
                  code: p.stock_code,
                  price: cur ?? entry,
                  change: pct != null ? parseFloat(pct) : 0,
                }
              : null;

          return (
            <div
              key={p.id}
              className={styles.pickCard}
              role={detail && onSelectStock ? "button" : undefined}
              tabIndex={detail && onSelectStock ? 0 : undefined}
              onClick={() => detail && onSelectStock?.(detail)}
              onKeyDown={(e) => e.key === "Enter" && detail && onSelectStock?.(detail)}
              style={detail && onSelectStock ? { cursor: "pointer" } : undefined}
            >
              <div>
                <div className={`${styles.pickName} ${blind ? styles.blur : ""}`}>{p.stock_name}</div>
                <div className={styles.pickSub}>
                  매수 {entry.toLocaleString()}원 · {p.entry_date}
                  {p.is_closed ? " · 종료" : ""}
                </div>
              </div>
              <div className={styles.pickRt}>
                <div className={styles.pickSub}>현재가</div>
                <div>{cur != null ? cur.toLocaleString() : "-"}</div>
                {pct != null && (
                  <div className={isUp ? styles.up : styles.down}>{isUp ? "+" : ""}{pct}%</div>
                )}
              </div>
            </div>
          );
        })
      )}
      {tier === "guest" && picks.length > 0 && (
        <p className={styles.footerHint}>
          <a href="/login" className={styles.loginLink}>
            로그인하고 종목명 확인
          </a>
        </p>
      )}
    </section>
  );
}
