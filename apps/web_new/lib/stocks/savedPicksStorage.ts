/**
 * 마켓 관심 담기 성공 시 기록 → 설정「내 종목 시세」의 담은 종목 표에 사용.
 */

const STORAGE_KEY = "jurin_saved_pick_positions_v1";

export type SavedPickPosition = {
  code: string;
  name: string;
  /** 추천(담기) 기준일 KST YYYY-MM-DD */
  recommendDate: string;
  /** 담기 시점 화면에 표시된 가격(추천금액) */
  entryPrice: number;
  savedAt: string;
};

function kstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

/** 관심 담기 API 성공 직후 호출. 동일 코드는 최신 담기로 갱신. */
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
