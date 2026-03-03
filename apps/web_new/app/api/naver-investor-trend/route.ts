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

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") || "kospi";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_SECRET_KEY) headers["X-API-KEY"] = API_SECRET_KEY;

  try {
    const url = `${API_BASE_URL}/api/naver-supply-data?data_type=investor_day&market=${market}`;
    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ success: false, data: [] }, { status: res.status });
    }

    const json = await res.json();
    const tableData = json.data as { headers: string[]; rows: string[][] } | null;

    if (!tableData?.headers || !tableData?.rows?.length) {
      return NextResponse.json({ success: true, data: [], bizdate: json.bizdate });
    }

    const hdrs = tableData.headers;
    const rows = tableData.rows;

    // 컬럼 인덱스 찾기
    const dateIdx = findColIdx(hdrs, ["날짜", "일자"]);
    const individualIdx = findColIdx(hdrs, ["개인"], ["기타"]);
    const foreignIdx = findColIdx(hdrs, ["외국인"], ["기타외국인", "기타"]);
    const institutionIdx = findColIdx(hdrs, ["기관계"]);
    const otherCorpIdx = findColIdx(hdrs, ["기타법인"]);

    // 최신 5일치만 사용 (rows는 최신순으로 오는 경우가 많음)
    const items: InvestorTrendItem[] = rows
      .slice(0, 20)
      .map((row) => ({
        date: dateIdx >= 0 ? row[dateIdx] ?? "" : "",
        individual: individualIdx >= 0 ? parseNum(row[individualIdx]) : 0,
        foreign: foreignIdx >= 0 ? parseNum(row[foreignIdx]) : 0,
        institution: institutionIdx >= 0 ? parseNum(row[institutionIdx]) : 0,
        other: otherCorpIdx >= 0 ? parseNum(row[otherCorpIdx]) : 0,
      }))
      .filter((item) => item.date && item.date !== "-")
      .slice(0, 5)
      .reverse(); // 오래된 날짜가 왼쪽에 오도록

    return NextResponse.json({ success: true, data: items, bizdate: json.bizdate });
  } catch (err) {
    console.error("투자자별 매매동향 조회 오류:", err);
    return NextResponse.json(
      { success: false, data: [], message: err instanceof Error ? err.message : "오류" },
      { status: 500 }
    );
  }
}
