/**
 * 마켓 추천「담기」 시 기록 → 설정「내 종목 시세」의 담은 종목 표에 사용.
 * 비우기 시 이력에 비우기 당시 기준가(clearPrice)를 저장해 수익률 표시.
 */

const STORAGE_KEY = "jurin_saved_pick_positions_v1";
const HISTORY_KEY = "jurin_saved_pick_history_v1";
/** 담기 이력은 비운 시각 기준 이 기간만 유지 (밀리초) */
const HISTORY_RETENTION_MS = 15 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = 200;

export type SavedPickPosition = {
  code: string;
  name: string;
  /** 추천(담기) 기준일 KST YYYY-MM-DD */
  recommendDate: string;
  /** 담기 시점 화면에 표시된 가격(추천금액) */
  entryPrice: number;
  savedAt: string;
};

export type ClearedPickHistory = {
  code: string;
  name: string;
  recommendDate: string;
  entryPrice: number;
  savedAt: string;
  /** 비우기 클릭 시점의 현재 기준가(지연 시세 스냅) */
  clearPrice: number | null;
  clearedAt: string;
};

function kstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pruneHistoryByAge(list: ClearedPickHistory[]): ClearedPickHistory[] {
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  return list.filter((h) => {
    const t = new Date(h.clearedAt).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
}

export function readSavedPickPositions(): SavedPickPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedPickPosition[]) : [];
  } catch {
    return [];
  }
}

export function readClearedPickHistory(): ClearedPickHistory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const rows = parsed as ClearedPickHistory[];
    const pruned = pruneHistoryByAge(rows).slice(0, MAX_HISTORY);
    if (pruned.length !== rows.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
}

/** 마켓 추천「담기」시 호출(관심종목 API와 무관). 동일 코드는 최신 담기로 갱신. */
export function recordSavedPickFromMarket(stock: { code: string; name: string; price: number }): void {
  if (typeof window === "undefined") return;
  const row: SavedPickPosition = {
    code: stock.code,
    name: stock.name,
    recommendDate: kstYmd(),
    entryPrice: Math.round(stock.price),
    savedAt: new Date().toISOString(),
  };
  const prev = readSavedPickPositions();
  const next = [row, ...prev.filter((p) => p.code !== row.code)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("savedPicksUpdated"));
}

/**
 * 담은 목록에서 제거하고 이력에 남김. clearPrice는 비우기 시점 기준가(없으면 null).
 */
export function removeSavedPickWithHistory(code: string, clearPrice: number | null): void {
  if (typeof window === "undefined") return;
  const list = readSavedPickPositions();
  const row = list.find((p) => p.code === code);
  if (!row) return;

  const nextList = list.filter((p) => p.code !== code);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));

  const hist: ClearedPickHistory = {
    code: row.code,
    name: row.name,
    recommendDate: row.recommendDate,
    entryPrice: row.entryPrice,
    savedAt: row.savedAt,
    clearPrice: clearPrice != null ? Math.round(clearPrice) : null,
    clearedAt: new Date().toISOString(),
  };
  const prevHist = readClearedPickHistory();
  const nextHist = pruneHistoryByAge([hist, ...prevHist]).slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHist));

  window.dispatchEvent(new Event("savedPicksUpdated"));
}
