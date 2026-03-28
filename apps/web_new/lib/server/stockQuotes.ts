/**
 * 서버 전용: 담은 종목 등 배치 시세 (네이버 지연 시세 우선, FSC 종가 폴백)
 * 종목코드 단위 메모리 캐시 + 싱글 플라이트 — 회원 수와 무관하게 동일 종목은 TTL 내 1회만 원천 조회
 */

import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export type StockQuoteSource = "naver_delayed" | "fsc_clpr";

export type StockQuoteEntry = {
  price: number;
  asOf: string | null;
  source: StockQuoteSource;
};

const CACHE_TTL_MS = 90_000;
const MAX_CODES = 40;

const cache = new Map<string, { entry: StockQuoteEntry; expiresAt: number }>();
const inflight = new Map<string, Promise<StockQuoteEntry | null>>();

function normalizeCode(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(0, 6);
}

type NaverBasicJson = {
  closePrice?: string;
  localTradedAt?: string;
  marketStatus?: string;
};

async function fetchNaverDelayed(code: string): Promise<{ price: number; asOf: string | null } | null> {
  const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as NaverBasicJson;
    const raw = j.closePrice?.replace(/,/g, "").trim();
    if (!raw) return null;
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return null;
    return { price: Math.round(n), asOf: j.localTradedAt ?? null };
  } catch {
    return null;
  }
}

type FscRow = { clpr?: string; bas_dt?: string };

async function fetchFscLatestClpr(code: string): Promise<{ price: number; asOf: string | null } | null> {
  if (!API_BASE_URL || !API_SECRET_KEY) return null;
  try {
    const params = new URLSearchParams({ srtn_cd: code, limit: "5" });
    const res = await fetch(`${API_BASE_URL}/api/fsc-stock-price?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_SECRET_KEY,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    const rows: FscRow[] = Array.isArray(j.data) ? j.data : [];
    if (rows.length === 0) return null;

    let best = rows[0];
    let bestDt = 0;
    for (const row of rows) {
      const dt = parseInt(String(row.bas_dt ?? "").replace(/\D/g, "") || "0", 10);
      if (dt >= bestDt) {
        bestDt = dt;
        best = row;
      }
    }
    if (best?.clpr == null) return null;
    const n = parseFloat(String(best.clpr).replace(/,/g, ""));
    if (Number.isNaN(n)) return null;
    const bas = best.bas_dt != null ? String(best.bas_dt) : null;
    return {
      price: Math.round(n),
      asOf: bas && bas.length === 8 ? `${bas.slice(0, 4)}-${bas.slice(4, 6)}-${bas.slice(6, 8)}` : bas,
    };
  } catch {
    return null;
  }
}

async function resolveOne(code: string): Promise<StockQuoteEntry | null> {
  const naver = await fetchNaverDelayed(code);
  if (naver) {
    return { price: naver.price, asOf: naver.asOf, source: "naver_delayed" };
  }
  const fsc = await fetchFscLatestClpr(code);
  if (fsc) {
    return { price: fsc.price, asOf: fsc.asOf, source: "fsc_clpr" };
  }
  return null;
}

async function getQuoteCached(code: string): Promise<StockQuoteEntry | null> {
  const now = Date.now();
  const hit = cache.get(code);
  if (hit && hit.expiresAt > now) {
    return hit.entry;
  }

  let pending = inflight.get(code);
  if (!pending) {
    pending = (async () => {
      try {
        return await resolveOne(code);
      } finally {
        inflight.delete(code);
      }
    })();
    inflight.set(code, pending);
  }

  const resolved = await pending;
  if (resolved) {
    cache.set(code, { entry: resolved, expiresAt: now + CACHE_TTL_MS });
  }
  return resolved;
}

/**
 * 고유 종목코드(6자리) 배열 → 시세 맵 (실패 시 null)
 */
export async function getBatchStockQuotes(rawCodes: string[]): Promise<{
  quotes: Record<string, StockQuoteEntry | null>;
  cacheTtlSeconds: number;
  servedAt: string;
}> {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawCodes) {
    const c = normalizeCode(raw);
    if (c && !seen.has(c)) {
      seen.add(c);
      normalized.push(c);
      if (normalized.length >= MAX_CODES) break;
    }
  }

  const entries = await Promise.all(
    normalized.map(async (code) => {
      const q = await getQuoteCached(code);
      return [code, q] as const;
    })
  );

  return {
    quotes: Object.fromEntries(entries),
    cacheTtlSeconds: Math.round(CACHE_TTL_MS / 1000),
    servedAt: new Date().toISOString(),
  };
}

export { normalizeCode as normalizeStockCode6, MAX_CODES, CACHE_TTL_MS };
