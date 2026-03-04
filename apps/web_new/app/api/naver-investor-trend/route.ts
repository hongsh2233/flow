import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

export interface InvestorTrendItem {
  date: string;
  individual: number;  // 개인
  foreign: number;     // 외국인
  institution: number; // 기관계
  other: number;       // 기타법인
}

function parseNum(v: string | undefined | null): number {
  if (!v || v.trim() === "" || v === "-") return 0;
  const s = v.replace(/,/g, "").replace(/\+/g, "").trim();
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function findColIdx(headers: string[], keywords: string[], excludes: string[] = []): number {
  return headers.findIndex((h) => {
    if (!h || typeof h !== "string") return false;
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

/** 백엔드에서 수급 데이터 조회 → InvestorTrendItem[] 변환 */
async function fetchFromBackend(
  market: string,
  apiKey: string,
): Promise<{ items: InvestorTrendItem[]; timestamp: string | null; debugInfo: object } | null> {
  const url = `${API_BASE_URL}/api/naver-supply-data?data_type=investor_day&market=${market}`;
  console.log(`[InvestorTrend] 백엔드 요청: ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    cache: "no-store",
  });

  console.log(`[InvestorTrend] 응답 상태 (market=${market}):`, res.status);
  if (!res.ok) return null;

  const json = await res.json();
  const tableData = json.data as { headers?: string[]; rows?: string[][] } | null;
  const timestamp = fmtTimestamp(json.bizdate, json.collected_time);

  const rowsLen = tableData?.rows?.length ?? 0;
  const hdrsLen = tableData?.headers?.length ?? 0;
  console.log(`[InvestorTrend] (market=${market}) headers:${hdrsLen} rows:${rowsLen}`);

  if (!rowsLen) return { items: [], timestamp, debugInfo: { market, hdrsLen, rowsLen, bizdate: json.bizdate } };

  const hdrs: string[] = tableData!.headers ?? [];
  const rows: string[][] = tableData!.rows!;

  // 헤더 기반 인덱스 탐색 → 실패 시 Naver 투자자별 매매동향 고정 인덱스 fallback
  // 확인된 컬럼 순서: 날짜(0), 개인(1), 외국인(2), 기관계(3), 금융투자(4)~연기금등(9), 기타법인(10)
  let dateIdx        = findColIdx(hdrs, ["날짜", "일자"]);
  let individualIdx  = findColIdx(hdrs, ["개인"], ["기타"]);
  let foreignIdx     = findColIdx(hdrs, ["외국인계", "외국인"], ["기타외국인"]);
  let institutionIdx = findColIdx(hdrs, ["기관계"]);
  let otherCorpIdx   = findColIdx(hdrs, ["기타법인"]);

  if (dateIdx < 0)        dateIdx = 0;
  if (individualIdx < 0)  individualIdx = 1;
  if (foreignIdx < 0)     foreignIdx = 2;
  if (institutionIdx < 0) institutionIdx = 3;
  if (otherCorpIdx < 0) {
    const sampleLen = rows[0]?.length ?? 0;
    otherCorpIdx = sampleLen >= 11 ? 10 : Math.max(0, sampleLen - 2);
  }

  console.log(`[InvestorTrend] 컬럼 인덱스: date=${dateIdx} individual=${individualIdx} foreign=${foreignIdx} institution=${institutionIdx} other=${otherCorpIdx}`);
  console.log(`[InvestorTrend] 첫 번째 행 샘플:`, rows[0]);

  const items: InvestorTrendItem[] = rows
    .slice(0, 20)
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
    .slice(0, 5)
    .reverse();

  console.log(`[InvestorTrend] 최종 items 수:`, items.length, items.map(i => i.date));

  const debugInfo = {
    market, hdrsLen, rowsLen, itemsLen: items.length,
    bizdate: json.bizdate, hdrs, firstRow: rows[0],
    indices: { dateIdx, individualIdx, foreignIdx, institutionIdx, otherCorpIdx },
  };
  return { items, timestamp, debugInfo };
}

// 백엔드 기본 API 키 (dependencies.py와 동일한 기본값)
const FALLBACK_API_KEY = "1978022019820308200705092018111420220303";

export async function GET(request: NextRequest) {
  const market = (request.nextUrl.searchParams.get("market") || "kospi") as "kospi" | "kosdaq";
  const apiKey = API_SECRET_KEY || FALLBACK_API_KEY;

  try {
    // 1순위: 요청한 market(kospi/kosdaq)
    const result = await fetchFromBackend(market, apiKey);
    if (result && result.items.length > 0) {
      return NextResponse.json({
        success: true, data: result.items, timestamp: result.timestamp, source: market,
      });
    }

    // 2순위: market=all fallback (kospi/kosdaq 데이터 없을 때)
    if (market !== "all") {
      console.log(`[InvestorTrend] market=${market} 데이터 없음, market=all 시도`);
      const allResult = await fetchFromBackend("all", apiKey);
      if (allResult && allResult.items.length > 0) {
        return NextResponse.json({
          success: true, data: allResult.items, timestamp: allResult.timestamp, source: "all",
        });
      }
    }

    console.warn("[InvestorTrend] 백엔드에서 데이터를 가져오지 못함");
    return NextResponse.json({ success: true, data: [], timestamp: null });

  } catch (err) {
    console.error("[InvestorTrend] 오류:", err);
    return NextResponse.json(
      { success: false, data: [], message: err instanceof Error ? err.message : "오류" },
      { status: 500 }
    );
  }
}
