import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export interface InvestorTrendItem {
  date: string;
  individual: number;  // 개인
  foreign: number;     // 외국인
  institution: number; // 기관계
  other: number;       // 기타법인
}

function parseNum(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (!v || v.trim() === "" || v === "-") return 0;
  const s = v.replace(/,/g, "").replace(/\+/g, "").trim();
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function findColIdx(headers: string[], keywords: string[], excludes: string[] = []): number {
  return headers.findIndex((h) => {
    const norm = h.replace(/\s/g, "");
    const matches = keywords.some((k) => norm.includes(k));
    const excluded = excludes.some((e) => norm.includes(e));
    return matches && !excluded;
  });
}

/** bizdate(YYYYMMDD) + collected_time(HH:mm) → "YYYY-MM-DD HH:mm" */
function fmtTimestamp(bizdate: string | null, collectedTime: string | null): string | null {
  if (!bizdate) return null;
  const d = String(bizdate).replace(/\D/g, "");
  if (d.length < 8) return null;
  const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return collectedTime ? `${date} ${collectedTime}` : date;
}

function normalizeFromTable(
  tableData: { headers?: string[]; rows?: string[][] } | null | undefined,
  takeLast: number
): InvestorTrendItem[] {
  if (!tableData?.rows?.length) return [];

  const hdrs: string[] = tableData.headers ?? [];
  const rows: string[][] = tableData.rows;

  let dateIdx        = findColIdx(hdrs, ["날짜", "일자"]);
  let individualIdx  = findColIdx(hdrs, ["개인"], ["기타"]);
  let foreignIdx     = findColIdx(hdrs, ["외국인계", "외국인"], ["기타외국인"]);
  let institutionIdx = findColIdx(hdrs, ["기관계", "기관"]);
  let otherCorpIdx   = findColIdx(hdrs, ["기타법인"]);

  if (dateIdx < 0)        dateIdx = 0;
  if (individualIdx < 0)  individualIdx = 1;
  if (foreignIdx < 0)     foreignIdx = 2;
  if (institutionIdx < 0) institutionIdx = 3;
  if (otherCorpIdx < 0) {
    const sampleLen = rows[0]?.length ?? 0;
    otherCorpIdx = sampleLen >= 11 ? 10 : Math.max(0, sampleLen - 2);
  }

  return rows
    .slice(0, 30)
    .map((row) => ({
      date:        row[dateIdx]        ?? "",
      individual:  parseNum(row[individualIdx]),
      foreign:     parseNum(row[foreignIdx]),
      institution: parseNum(row[institutionIdx]),
      other:       parseNum(row[otherCorpIdx]),
    }))
    .filter((item) => {
      const d = item.date.trim();
      return d && d !== "-" && d !== "날짜" && d !== "일자";
    })
    .slice(-takeLast)
    .reverse();
}

function normalizeFromObjects(arr: unknown[], takeLast: number): InvestorTrendItem[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];

  const items: InvestorTrendItem[] = [];

  for (const raw of arr) {
    const r = raw as Record<string, unknown>;

    const date =
      (r.date as string | undefined) ??
      (r["날짜"] as string | undefined) ??
      (r["일자"] as string | undefined) ??
      "";

    if (!date) continue;

    const individual =
      parseNum((r.individual as number | string | undefined) ?? (r["개인"] as number | string | undefined));
    const foreign =
      parseNum((r.foreign as number | string | undefined) ?? (r["외국인"] as number | string | undefined));
    const institution =
      parseNum(
        (r.institution as number | string | undefined) ??
          (r["기관계"] as number | string | undefined) ??
          (r["기관"] as number | string | undefined),
      );
    const other =
      parseNum((r.other as number | string | undefined) ?? (r["기타법인"] as number | string | undefined));

    items.push({ date, individual, foreign, institution, other });
  }

  return items.slice(-takeLast);
}

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") || "kospi";
  const dataType = request.nextUrl.searchParams.get("data_type") || "investor_time";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(20, parseInt(limitParam, 10) || 5)) : null;

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_SECRET_KEY) {
    reqHeaders["X-API-KEY"] = API_SECRET_KEY;
  }

  const takeLast = limit ?? (dataType === "investor_time" ? 15 : 5);

  async function fetchAndNormalize(targetMarket: string): Promise<{
    items: InvestorTrendItem[];
    timestamp: string | null;
    rawDataShape: string;
  }> {
    const url = `${API_BASE_URL}/api/naver-supply-data?data_type=${dataType}&market=${targetMarket}`;
    const res = await fetch(url, { method: "GET", headers: reqHeaders, cache: "no-store" });

    if (!res.ok) {
      return { items: [], timestamp: null, rawDataShape: `http_error_${res.status}` };
    }

    const json = await res.json();
    const timestamp = fmtTimestamp(json.bizdate, json.collected_time);

    let items: InvestorTrendItem[] = [];
    const data = json.data;

    if (data && typeof data === "object" && !Array.isArray(data) && "rows" in data) {
      items = normalizeFromTable(data as { headers?: string[]; rows?: string[][] }, takeLast);
    }

    let arr: unknown[] | null = null;
    if (Array.isArray(data)) {
      arr = data;
    } else if (data && typeof data === "object") {
      const anyData = data as Record<string, unknown>;
      if (Array.isArray(anyData.items)) arr = anyData.items as unknown[];
      else if (Array.isArray(anyData.list)) arr = anyData.list as unknown[];
    }
    if ((!items || items.length === 0) && arr) {
      items = normalizeFromObjects(arr, takeLast);
    }

    const rawDataShape = Array.isArray(data) ? "array" : String(typeof data);
    return { items, timestamp, rawDataShape };
  }

  try {
    const first = await fetchAndNormalize(market);

    if (first.items.length === 0 && market !== "all") {
      const fallback = await fetchAndNormalize("all");
      if (fallback.items.length > 0) {
        return NextResponse.json({
          success: true,
          data: fallback.items,
          timestamp: fallback.timestamp,
          used_market: "all",
        });
      }
    }

    if (first.items.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        timestamp: first.timestamp,
        debug_shape: first.rawDataShape,
      });
    }

    return NextResponse.json({
      success: true,
      data: first.items,
      timestamp: first.timestamp,
      used_market: market,
    });
  } catch (err) {
    console.error("투자자별 매매동향 조회 오류:", err);
    return NextResponse.json(
      { success: false, data: [], message: err instanceof Error ? err.message : "오류" },
      { status: 500 }
    );
  }
}
