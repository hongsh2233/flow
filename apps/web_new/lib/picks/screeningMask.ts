import { screeningVisibleRankCount, type PicksGradeTier } from "./gradeTier";

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
  "ma20",
  "ma60",
  "ma224",
  "ma_gap",
  "box_high",
  "box_low",
  "box_range_pct",
  "touch_count",
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
 * Family 전체 공개 / 비회원 0행·일반 2행·VIP 5행까지 공개, 나머지 마스킹
 */
export function applyScreeningMask(rows: ScreeningRow[], tier: PicksGradeTier): ScreeningRow[] {
  const cap = screeningVisibleRankCount(tier);
  if (cap === null) return rows.map((r) => ({ ...r }));
  if (cap === 0) return [];
  return rows.map((row, i) => (i < cap ? { ...row } : maskRow(row)));
}
