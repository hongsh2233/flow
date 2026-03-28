import type { PicksGradeTier } from "./gradeTier";

export type ScreeningRow = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "stock_code",
  "stock_name",
  "current_price",
  "change_percent",
  "volume",
  "tenkan_sen",
  "kijun_sen",
  "cloud_position",
  "is_new_high_120",
  "matched_conditions",
  "trading_value",
  "trading_value_rank",
  "market_cap",
  "high_ratio",
  "ma5",
  "rsi14",
  "volume_ratio",
]);

function maskRow(row: ScreeningRow): ScreeningRow {
  const out: ScreeningRow = { ...row };
  for (const k of SENSITIVE_KEYS) {
    if (k in out) {
      if (k === "matched_conditions") out[k] = "***";
      else if (k === "is_new_high_120") out[k] = null;
      else out[k] = "***";
    }
  }
  return out;
}

/**
 * family: 전체 공개 / guest·regular·vip: 1순위만 공개 (기획서 비회원·회원 정책)
 */
export function applyScreeningMask(rows: ScreeningRow[], tier: PicksGradeTier): ScreeningRow[] {
  if (tier === "family") return rows.map((r) => ({ ...r }));
  return rows.map((row, i) => (i === 0 ? { ...row } : maskRow(row)));
}
