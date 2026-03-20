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

interface NaverSupplyPayload {
  success?: boolean;
  data?: NaverTable | null;
  bizdate?: string | null;
  collected_time?: string | null;
  message?: string;
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

/** 투자자 3컬럼 합산 점수 — 0만 있는 요약/빈 행과 실제 구간 행 구분용 */
function investorRowScore(
  row: string[],
  individualIdx: number,
  foreignIdx: number,
  institutionIdx: number
): number {
  let s = 0;
  if (individualIdx >= 0 && row[individualIdx] !== undefined) {
    s += Math.abs(parseNum(row[individualIdx]));
  }
  if (foreignIdx >= 0 && row[foreignIdx] !== undefined) {
    s += Math.abs(parseNum(row[foreignIdx]));
  }
  if (institutionIdx >= 0 && row[institutionIdx] !== undefined) {
    s += Math.abs(parseNum(row[institutionIdx]));
  }
  return s;
}

/**
 * 네이버 시간별 표는 최신이 맨 위이거나 맨 아래일 수 있음 → 첫/마지막 행 중
 * 수치가 더 채워진 쪽을 사용 (백엔드 Gemini 파서는 rows[-1] 고정이라 여기서 보완).
 */
function pickInvestorRow(hdrs: string[], rows: string[][]): string[] | null {
  if (!rows.length) return null;
  const individualIdx = findColIdx(hdrs, ["개인"], ["기타"]);
  const foreignIdx = findColIdx(hdrs, ["외국인계", "외국인"], ["기타외국인"]);
  const institutionIdx = findColIdx(hdrs, ["기관계", "기관"]);
  if (rows.length === 1) return rows[0];
  const first = rows[0];
  const last = rows[rows.length - 1];
  const sLast = investorRowScore(last, individualIdx, foreignIdx, institutionIdx);
  const sFirst = investorRowScore(first, individualIdx, foreignIdx, institutionIdx);
  return sLast >= sFirst ? last : first;
}

function programAbsSumFromRow(row: string[], hdrs: string[]): number {
  const arbCol = hdrs.findIndex(
    (h) => h.replace(/\s/g, "").includes("차익") && h.replace(/\s/g, "").includes("순매수") && !h.includes("비차익")
  );
  const nonArbCol = hdrs.findIndex(
    (h) => h.replace(/\s/g, "").includes("비차익") && h.replace(/\s/g, "").includes("순매수")
  );
  let arb = 0;
  let non = 0;
  if (arbCol >= 0 && row[arbCol] !== undefined) {
    arb = parseNum(row[arbCol]);
  } else if (hdrs.length >= 4 && row[3] !== undefined) {
    arb = parseNum(row[3]);
  }
  if (nonArbCol >= 0 && row[nonArbCol] !== undefined) {
    non = parseNum(row[nonArbCol]);
  } else if (row.length >= 7) {
    non = parseNum(row[6]);
  }
  return Math.abs(arb) + Math.abs(non);
}

function pickProgramRow(hdrs: string[], rows: string[][]): string[] | null {
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const first = rows[0];
  const last = rows[rows.length - 1];
  const sLast = programAbsSumFromRow(last, hdrs);
  const sFirst = programAbsSumFromRow(first, hdrs);
  return sLast >= sFirst ? last : first;
}

function parseNumbersFromTables(investorData?: NaverTable | null, programData?: NaverTable | null): Omit<MarketSlice, "aiSummary"> {
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
    const dataRow = pickInvestorRow(hdrs, rows);
    if (dataRow) {
      const individualIdx = findColIdx(hdrs, ["개인"], ["기타"]);
      const foreignIdx = findColIdx(hdrs, ["외국인계", "외국인"], ["기타외국인"]);
      const institutionIdx = findColIdx(hdrs, ["기관계", "기관"]);

      if (individualIdx >= 0 && dataRow[individualIdx] !== undefined) {
        result.individual = parseNum(dataRow[individualIdx]);
      }
      if (foreignIdx >= 0 && dataRow[foreignIdx] !== undefined) {
        result.foreign = parseNum(dataRow[foreignIdx]);
      }
      if (institutionIdx >= 0 && dataRow[institutionIdx] !== undefined) {
        result.institution = parseNum(dataRow[institutionIdx]);
      }
    }
  }

  if (programData?.headers?.length && programData?.rows?.length) {
    const hdrs = programData.headers as string[];
    const rows = programData.rows as string[][];
    const dataRow = pickProgramRow(hdrs, rows);
    if (dataRow) {
      const arbCol = hdrs.findIndex(
        (h) => h.replace(/\s/g, "").includes("차익") && h.replace(/\s/g, "").includes("순매수") && !h.includes("비차익")
      );
      const nonArbCol = hdrs.findIndex(
        (h) => h.replace(/\s/g, "").includes("비차익") && h.replace(/\s/g, "").includes("순매수")
      );

      if (arbCol >= 0 && dataRow[arbCol] !== undefined) {
        result.programArbitrage = parseNum(dataRow[arbCol]);
      } else if (hdrs.length >= 4) {
        result.programArbitrage = parseNum(dataRow[3]);
      }
      if (nonArbCol >= 0 && dataRow[nonArbCol] !== undefined) {
        result.programNonArbitrage = parseNum(dataRow[nonArbCol]);
      } else if (dataRow.length >= 7) {
        result.programNonArbitrage = parseNum(dataRow[6]);
      }
    }
  }

  return result;
}

function isUsableTablePayload(p: NaverSupplyPayload): boolean {
  if (p.success === false) return false;
  const t = p.data;
  return Boolean(t?.headers?.length && t?.rows?.length);
}

async function fetchNaverSupply(
  base: string,
  hdrs: Record<string, string>,
  dataType: string,
  market: string
): Promise<NaverSupplyPayload> {
  const res = await fetch(
    `${base}/api/naver-supply-data?data_type=${encodeURIComponent(dataType)}&market=${encodeURIComponent(market)}`,
    { method: "GET", headers: hdrs, cache: "no-store" }
  );
  if (!res.ok) return { success: false, data: null, bizdate: null, collected_time: null };
  try {
    return (await res.json()) as NaverSupplyPayload;
  } catch {
    return { success: false, data: null, bizdate: null, collected_time: null };
  }
}

/** 시간별 우선, 없으면 일별 (수집 스냅이 장후 일별만 있을 때 대비) */
async function loadMarketSupply(
  base: string,
  hdrs: Record<string, string>,
  market: "kospi" | "kosdaq"
): Promise<{ inv: NaverSupplyPayload; prog: NaverSupplyPayload }> {
  const [invT, progT] = await Promise.all([
    fetchNaverSupply(base, hdrs, "investor_time", market),
    fetchNaverSupply(base, hdrs, "program_time", market),
  ]);
  const [inv, prog] = await Promise.all([
    isUsableTablePayload(invT) ? Promise.resolve(invT) : fetchNaverSupply(base, hdrs, "investor_day", market),
    isUsableTablePayload(progT) ? Promise.resolve(progT) : fetchNaverSupply(base, hdrs, "program_day", market),
  ]);
  return { inv, prog };
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
    const [kospiPair, kosdaqPair] = await Promise.all([
      loadMarketSupply(base, headers, "kospi"),
      loadMarketSupply(base, headers, "kosdaq"),
    ]);
    const invKospi = kospiPair.inv;
    const progKospi = kospiPair.prog;
    const invKosdaq = kosdaqPair.inv;
    const progKosdaq = kosdaqPair.prog;

    if (!isUsableTablePayload(invKospi) || !isUsableTablePayload(invKosdaq)) {
      return NextResponse.json(errorBody());
    }

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
