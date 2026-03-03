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

// 백엔드 기본 API 키 (dependencies.py와 동일한 기본값)
const FALLBACK_API_KEY = "1978022019820308200705092018111420220303";

function normalizeFromTable(tableData: { headers?: string[]; rows?: string[][] } | null | undefined): InvestorTrendItem[] {
  if (!tableData?.rows?.length) return [];

  const hdrs: string[] = tableData.headers ?? [];
  const rows: string[][] = tableData.rows;

  // 헤더 기반 탐색 → 실패 시 Naver 투자자별 매매동향 고정 인덱스 fallback
  // 고정 인덱스: 날짜(0), 개인(1), 외국인(2), 기관계(3), 금융투자(4)~연기금등(9), 기타법인(10)
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
}

function normalizeFromObjects(arr: unknown[]): InvestorTrendItem[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];

  const items: InvestorTrendItem[] = [];

  for (const raw of arr) {
    const r = raw as Record<string, unknown>;

    // 날짜 키 후보
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

  return items.slice(-5); // 최근 5개만 사용
}

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") || "kospi";

  const apiKey = API_SECRET_KEY || FALLBACK_API_KEY;
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey,
  };

  try {
    const url = `${API_BASE_URL}/api/naver-supply-data?data_type=investor_day&market=${market}`;
    const res = await fetch(url, { method: "GET", headers: reqHeaders, cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ success: false, data: [] }, { status: res.status });
    }

    const json = await res.json();
    const timestamp = fmtTimestamp(json.bizdate, json.collected_time);

    let items: InvestorTrendItem[] = [];

    // 1) 관리자/기존 형태: { headers, rows }
    if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
      items = normalizeFromTable(json.data as { headers?: string[]; rows?: string[][] });
    }

    // 2) 당신이 예시로 준 형태: [{ 날짜:"2026-03-02", 기관:..., 개인:..., 외국인:..., 기타법인:... }, ...]
    if ((!items || items.length === 0) && Array.isArray(json.data)) {
      items = normalizeFromObjects(json.data);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        timestamp,
        debug_shape: Array.isArray(json.data) ? "array" : typeof json.data,
      });
    }

    return NextResponse.json({ success: true, data: items, timestamp });
  } catch (err) {
    console.error("투자자별 매매동향 조회 오류:", err);
    return NextResponse.json(
      { success: false, data: [], message: err instanceof Error ? err.message : "오류" },
      { status: 500 }
    );
  }
}
