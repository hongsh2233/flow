"use client";

import type { PicksGradeTier } from "@/lib/picks/gradeTier";
import type { StockDetail } from "@/lib/types";
import styles from "./Picks.module.css";

export type ScreeningRow = Record<string, unknown>;

function formatPrice(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return v.toLocaleString();
  const s = String(v);
  if (s === "***") return "***";
  const n = parseFloat(s.replace(/,/g, ""));
  if (!isNaN(n)) return n.toLocaleString();
  return s;
}

function rowToDetail(row: ScreeningRow): StockDetail | null {
  const name = row.stock_name;
  const code = row.stock_code;
  if (name === "***" || code === "***") return null;
  const priceRaw = row.current_price;
  const chgRaw = row.change_percent;
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : parseFloat(String(priceRaw).replace(/,/g, "")) || 0;
  const change =
    typeof chgRaw === "number"
      ? chgRaw
      : parseFloat(String(chgRaw).replace(/[%,+]/g, "")) || 0;
  return {
    name: String(name),
    code: String(code),
    price,
    change,
  };
}

type Props = {
  rows: ScreeningRow[];
  tier: PicksGradeTier;
  onSelectStock?: (s: StockDetail) => void;
  onAddFavorite?: (s: StockDetail) => void;
  favCodes?: Set<string>;
};

export function ScreeningResultTable({ rows, tier, onSelectStock, onAddFavorite, favCodes }: Props) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>종목명</th>
            <th>코드</th>
            <th>가격</th>
            <th>등락률</th>
            <th>담기</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.empty}>
                데이터가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const blinded = row.stock_name === "***";
              const detail = rowToDetail(row);
              const code = detail?.code ?? "";
              const added = Boolean(code && favCodes?.has(code));

              return (
                <tr key={`${row.rank}-${idx}`}>
                  <td className={blinded ? styles.blur : undefined}>
                    {detail && onSelectStock ? (
                      <button
                        type="button"
                        className={styles.nameLink}
                        onClick={() => onSelectStock(detail)}
                      >
                        {String(row.stock_name ?? "-")}
                      </button>
                    ) : (
                      String(row.stock_name ?? "-")
                    )}
                  </td>
                  <td className={blinded ? styles.blur : undefined}>{String(row.stock_code ?? "-")}</td>
                  <td className={blinded ? styles.blur : undefined}>{formatPrice(row.current_price)}</td>
                  <td className={blinded ? styles.blur : undefined}>
                    {row.change_percent != null ? String(row.change_percent) : "-"}
                  </td>
                  <td>
                    {blinded || !detail || !onAddFavorite ? (
                      <span className={styles.addMuted}>—</span>
                    ) : added ? (
                      <span className={styles.addDone}>담김</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddFavorite(detail);
                        }}
                      >
                        담기
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {tier === "guest" && (
        <p className={styles.footerHint}>
          <a href="/login" className={styles.loginLink}>
            로그인하고 혜택 확인
          </a>
        </p>
      )}
      {tier === "member_limited" && (
        <p className={styles.footerHint}>
          일반·VIP는 상위 1종목만 공개됩니다. Family는 전체 종목을 열람할 수 있습니다.
        </p>
      )}
    </div>
  );
}
