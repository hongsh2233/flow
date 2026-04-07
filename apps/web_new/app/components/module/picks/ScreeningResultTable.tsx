"use client";

import type { PicksGradeTier } from "@/lib/picks/gradeTier";
import type { ScreeningPickMeta } from "@/lib/picks/screeningPick";
import type { StockDetail } from "@/lib/types";
import { MtsAppIcon } from "./MtsAppIcon";
import { AddPicksIcon } from "./AddPicksIcon";
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

function changeDirection(raw: unknown): "up" | "down" | "flat" {
  if (raw == null) return "flat";
  const s = String(raw).trim();
  if (s === "" || s === "-" || s === "***") return "flat";
  if (s.startsWith("-") || s.startsWith("▼")) return "down";
  if (s.startsWith("+") || s.startsWith("▲")) return "up";
  const n = parseFloat(s.replace(/[%,+▲▼]/g, "").replace(/,/g, ""));
  if (Number.isNaN(n)) return "flat";
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
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
  onPickStock?: (s: StockDetail, meta: ScreeningPickMeta) => void;
  screeningDate: string | null;
  screeningType: "ichimoku" | "jongbe" | "ricebowl" | "breakout";
  pickedCodes?: Set<string>;
  onMtsClick?: () => void;
};

export function ScreeningResultTable({
  rows,
  tier,
  onSelectStock,
  onPickStock,
  screeningDate,
  screeningType,
  pickedCodes,
  onMtsClick,
}: Props) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.thName}>
              종목명
            </th>
            <th scope="col">가격</th>
            <th scope="col">등락률</th>
            <th scope="col" className={styles.thIcon}>
              <span className={styles.srOnly}>종목 담기</span>
            </th>
            <th scope="col" className={styles.thIcon}>
              <span className={styles.srOnly}>MTS</span>
            </th>
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
              const rankNum =
                typeof row.rank === "number"
                  ? row.rank
                  : parseInt(String(row.rank ?? ""), 10) || idx + 1;
              const code = detail?.code ?? "";
              const added = Boolean(code && pickedCodes?.has(code));
              const chg = changeDirection(row.change_percent);
              const chgClass =
                chg === "up" ? styles.chgUp : chg === "down" ? styles.chgDown : styles.chgFlat;

              const nameStr = String(row.stock_name ?? "-");
              const codeStr = String(row.stock_code ?? "-");

              return (
                <tr key={`${row.rank}-${idx}`}>
                  <td className={`${styles.tdName} ${blinded ? styles.blur : ""}`}>
                    {detail && onSelectStock ? (
                      <button
                        type="button"
                        className={styles.nameLink}
                        onClick={() => onSelectStock(detail)}
                      >
                        {nameStr}
                        <br />
                        <span className={styles.codeInName}>({codeStr})</span>
                      </button>
                    ) : (
                      <>
                        {nameStr}
                        <br />
                        <span className={styles.codeInName}>({codeStr})</span>
                      </>
                    )}
                  </td>
                  <td className={blinded ? styles.blur : undefined}>{formatPrice(row.current_price)}</td>
                  <td className={blinded ? styles.blur : chgClass}>
                    {row.change_percent != null ? String(row.change_percent) : "-"}
                  </td>
                  <td className={styles.tdIcon}>
                    {blinded || !detail || !onPickStock ? (
                      <span className={styles.addMuted} aria-hidden>
                        —
                      </span>
                    ) : added ? (
                      <span className={styles.iconBtnDone} title="담김" aria-label="종목 담김">
                        <AddPicksIcon size={20} isAdded={true} aria-hidden />
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="담기"
                        aria-label="종목 담기"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickStock(detail, {
                            rank: rankNum,
                            screeningDate,
                            screeningType,
                          });
                        }}
                      >
                        <AddPicksIcon size={20} isAdded={false} aria-hidden />
                      </button>
                    )}
                  </td>
                  <td className={styles.tdIcon}>
                    {blinded || !onMtsClick ? (
                      <span className={styles.addMuted} aria-hidden>
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="MTS"
                        aria-label="증권사 MTS"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMtsClick();
                        }}
                      >
                        <MtsAppIcon size={18} />
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
      {tier === "member" && (
        <p className={styles.footerHint}>
          일반 회원은 상위 2종목만 공개됩니다. VIP 5종목, Family는 전체를 열람할 수 있습니다.
        </p>
      )}
      {tier === "vip" && (
        <p className={styles.footerHint}>
          VIP는 상위 5종목까지 공개됩니다. Family는 전체 종목을 열람할 수 있습니다.
        </p>
      )}
    </div>
  );
}
