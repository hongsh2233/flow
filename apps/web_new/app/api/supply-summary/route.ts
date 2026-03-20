import { NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

function parseNum(val: string): number {
  const s = String(val).replace(/,/g, "").replace(/\+/g, "").trim();
  if (!s || s === "-") return 0;
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

interface NaverTable {
  headers?: string[];
  rows?: string[][];
}

interface NaverJson {
  data?: NaverTable;
  bizdate?: string | null;
  collected_time?: string | null;
}

export interface MarketSlice {
  foreign: number;
  individual: number;
  institution: number;
  programArbitrage: number;
  programNonArbitrage: number;
  aiSummary: string | null;
}

interface SupplySummary {
  success: boolean;
  mode: "intraday" | "closing";
  timeLabel: string;
  bizdate: string | null;
  collectedTime: string | null;
  kospi: MarketSlice;
  kosdaq: MarketSlice;
}

function emptySlice(): MarketSlice {
  return {
    foreign: 0,
    individual: 0,
    institution: 0,
    programArbitrage: 0,
    programNonArbitrage: 0,
    aiSummary: null,
  };
}

function parseNumbersFromTables(investorData?: NaverTable, programData?: NaverTable): Omit<MarketSlice, "aiSummary"> {
  const result = {
    foreign: 0,
    individual: 0,
    institution: 0,
    programArbitrage: 0,
    programNonArbitrage: 0,
  };

  if (investorData?.headers?.length && investorData?.rows?.length) {
    const hdrs = investorData.headers as string[];
    const rows = investorData.rows as string[][];
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const individualIdx = findColIdx(hdrs, ["개인"], ["기타"]);
      const foreignIdx = findColIdx(hdrs, ["외국인계", "외국인"], ["기타외국인"]);
      const institutionIdx = findColIdx(hdrs, ["기관계", "기관"]);

      if (individualIdx >= 0 && lastRow[individualIdx] !== undefined) {
        result.individual = parseNum(lastRow[individualIdx]);
      }
      if (foreignIdx >= 0 && lastRow[foreignIdx] !== undefined) {
        result.foreign = parseNum(lastRow[foreignIdx]);
      }
      if (institutionIdx >= 0 && lastRow[institutionIdx] !== undefined) {
        result.institution = parseNum(lastRow[institutionIdx]);
      }
    }
  }

  if (programData?.headers?.length && programData?.rows?.length) {
    const hdrs = programData.headers as string[];
    const rows = programData.rows as string[][];
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const arbCol = hdrs.findIndex(
        (h) => h.replace(/\s/g, "").includes("차익") && h.replace(/\s/g, "").includes("순매수") && !h.includes("비차익")
      );
      const nonArbCol = hdrs.findIndex(
        (h) => h.replace(/\s/g, "").includes("비차익") && h.replace(/\s/g, "").includes("순매수")
      );

      if (arbCol >= 0 && lastRow[arbCol] !== undefined) {
        result.programArbitrage = parseNum(lastRow[arbCol]);
      } else if (hdrs.length >= 4) {
        result.programArbitrage = parseNum(lastRow[3]);
      }
      if (nonArbCol >= 0 && lastRow[nonArbCol] !== undefined) {
        result.programNonArbitrage = parseNum(lastRow[nonArbCol]);
      } else if (hdrs.length >= 7) {
        result.programNonArbitrage = parseNum(lastRow[6]);
      }
    }
  }

  return result;
}

function errorBody(): SupplySummary {
  return {
    success: false,
    mode: "intraday",
    timeLabel: "",
    bizdate: null,
    collectedTime: null,
    kospi: emptySlice(),
    kosdaq: emptySlice(),
  };
}

export async function GET() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_SECRET_KEY) {
    headers["X-API-KEY"] = API_SECRET_KEY;
  }

  try {
    const base = API_BASE_URL;
    const [invKospiRes, progKospiRes, invKosdaqRes, progKosdaqRes] = await Promise.all([
      fetch(`${base}/api/naver-supply-data?data_type=investor_time&market=kospi`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${base}/api/naver-supply-data?data_type=program_time&market=kospi`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${base}/api/naver-supply-data?data_type=investor_time&market=kosdaq`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${base}/api/naver-supply-data?data_type=program_time&market=kosdaq`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
    ]);

    if (!invKospiRes.ok || !progKospiRes.ok || !invKosdaqRes.ok || !progKosdaqRes.ok) {
      return NextResponse.json(errorBody());
    }

    const [invKospi, progKospi, invKosdaq, progKosdaq] = await Promise.all([
      invKospiRes.json() as Promise<NaverJson>,
      progKospiRes.json() as Promise<NaverJson>,
      invKosdaqRes.json() as Promise<NaverJson>,
      progKosdaqRes.json() as Promise<NaverJson>,
    ]);

    const bizdateForAi =
      invKospi.bizdate ?? progKospi.bizdate ?? invKosdaq.bizdate ?? progKosdaq.bizdate ?? null;
    const collectedTimeForAi =
      invKospi.collected_time ??
      progKospi.collected_time ??
      invKosdaq.collected_time ??
      progKosdaq.collected_time ??
      null;

    let aiKospiJson = { success: false as boolean, ai_summary: null as string | null };
    let aiKosdaqJson = { success: false as boolean, ai_summary: null as string | null };

    if (bizdateForAi && collectedTimeForAi) {
      const qKospi = new URLSearchParams({
        bizdate: String(bizdateForAi),
        collected_time: String(collectedTimeForAi),
        market: "kospi",
      });
      const qKosdaq = new URLSearchParams({
        bizdate: String(bizdateForAi),
        collected_time: String(collectedTimeForAi),
        market: "kosdaq",
      });
      const [aiKospiRes, aiKosdaqRes] = await Promise.all([
        fetch(`${base}/api/supply-summary-ai?${qKospi}`, { method: "GET", headers, cache: "no-store" }),
        fetch(`${base}/api/supply-summary-ai?${qKosdaq}`, { method: "GET", headers, cache: "no-store" }),
      ]);
      if (aiKospiRes.ok) {
        aiKospiJson = await aiKospiRes.json();
      }
      if (aiKosdaqRes.ok) {
        aiKosdaqJson = await aiKosdaqRes.json();
      }
    }

    const numsKospi = parseNumbersFromTables(invKospi.data, progKospi.data);
    const numsKosdaq = parseNumbersFromTables(invKosdaq.data, progKosdaq.data);

    let mode: "intraday" | "closing" = "intraday";
    let timeLabel = "";
    if (collectedTimeForAi) {
      const hhmm = parseInt(collectedTimeForAi.replace(":", ""), 10) || 0;
      mode = hhmm >= 1530 ? "closing" : "intraday";
      timeLabel =
        mode === "closing" ? "코스피·코스닥 장 마감 수급" : `장중 수급 (${collectedTimeForAi} 기준)`;
    }

    const result: SupplySummary = {
      success: true,
      mode,
      timeLabel,
      bizdate: bizdateForAi,
      collectedTime: collectedTimeForAi,
      kospi: {
        ...numsKospi,
        aiSummary: aiKospiJson.success && aiKospiJson.ai_summary ? aiKospiJson.ai_summary : null,
      },
      kosdaq: {
        ...numsKosdaq,
        aiSummary: aiKosdaqJson.success && aiKosdaqJson.ai_summary ? aiKosdaqJson.ai_summary : null,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("수급 요약 조회 오류:", err);
    return NextResponse.json(errorBody(), { status: 500 });
  }
}
