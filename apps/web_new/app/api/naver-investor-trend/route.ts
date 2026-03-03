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

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") || "kospi";

  const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (API_SECRET_KEY) reqHeaders["X-API-KEY"] = API_SECRET_KEY;

  try {
    const url = `${API_BASE_URL}/api/naver-supply-data?data_type=investor_day&market=${market}`;
    const res = await fetch(url, { method: "GET", headers: reqHeaders, cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ success: false, data: [] }, { status: res.status });
    }

    const json = await res.json();
    const tableData = json.data as { headers: string[]; rows: string[][] } | null;
    const timestamp = fmtTimestamp(json.bizdate, json.collected_time);

    if (!tableData?.rows?.length) {
      return NextResponse.json({ success: true, data: [], timestamp });
    }

    const hdrs: string[] = tableData.headers ?? [];
    const rows: string[][] = tableData.rows;

    // 헤더 기반 탐색 → 실패 시 Naver 투자자별 매매동향 고정 인덱스 fallback
    // 고정 인덱스: 날짜(0), 개인(1), 외국인(2), 기관계(3), 금융투자(4)~연기금등(9), 기타법인(10)
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
      .reverse(); // 오래된 날짜가 왼쪽에 오도록

    return NextResponse.json({ success: true, data: items, timestamp, debug_headers: hdrs });
  } catch (err) {
    console.error("투자자별 매매동향 조회 오류:", err);
    return NextResponse.json(
      { success: false, data: [], message: err instanceof Error ? err.message : "오류" },
      { status: 500 }
    );
  }
}
