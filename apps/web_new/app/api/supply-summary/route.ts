import { NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

function parseNum(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (!v || String(v).trim() === "" || v === "-") return 0;
  const s = String(v).replace(/,/g, "").replace(/\+/g, "").trim();
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

function naverJsonHasRows(json: NaverJson): boolean {
  return Boolean(json.data?.rows?.length);
}

/** 관리자 naver-ranking·supply 페이지와 동일: 시장별 행이 없으면 market=all 로 재시도 */
async function fetchNaverSupplySnapshot(
  base: string,
  headers: Record<string, string>,
  dataType: string,
  market: "kospi" | "kosdaq"
): Promise<NaverJson> {
  const root = base.replace(/\/+$/, "");
  const buildUrl = (m: string) =>
    `${root}/api/naver-supply-data?data_type=${encodeURIComponent(dataType)}&market=${encodeURIComponent(m)}`;
  const load = async (m: string): Promise<NaverJson> => {
    const res = await fetch(buildUrl(m), { method: "GET", headers, cache: "no-store" });
    if (!res.ok) return { data: undefined, bizdate: null, collected_time: null };
    return (await res.json()) as NaverJson;
  };
  const primary = await load(market);
  if (naverJsonHasRows(primary)) return primary;
  const fallback = await load("all");
  return naverJsonHasRows(fallback) ? fallback : primary;
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

/** supply_summary_gemini_service._time_label_for_collected_time 와 동일 (Gemini 프롬프트·UI 라벨 정합) */
function timeLabelFromCollectedTime(collectedTime: string): Pick<SupplySummary, "mode" | "timeLabel"> {
  const [hStr, mStr] = collectedTime.split(":");
  const hour = parseInt(hStr || "0", 10);
  const minute = parseInt(mStr || "0", 10);
  if (hour >= 15 && (hour > 15 || minute >= 30)) {
    return { mode: "closing", timeLabel: "금일 15:30분 정규장 마감 기준" };
  }
  const prevH = hour > 0 ? hour - 1 : 23;
  const slotM = minute >= 30 ? 30 : 0;
  return {
    mode: "intraday",
    timeLabel: `현재 ${String(prevH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}~${String(hour).padStart(2, "0")}:${String(slotM).padStart(2, "0")} 기준`,
  };
}

/**
 * 파이프라인: 관리자 스케줄러가 naver_supply_data 수집 → Gemini 가공 → supply_summary_ai_summaries 저장.
 * 여기서는 최신 수집분 숫자(naver-supply-data) + 동일 bizdate·collected_time 의 DB 요약(supply-summary-ai)을 합쳐 반환.
 */
export async function GET() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_SECRET_KEY) {
    headers["X-API-KEY"] = API_SECRET_KEY;
  }

  try {
    const base = API_BASE_URL;
    const [invKospi, progKospi, invKosdaq, progKosdaq] = await Promise.all([
      fetchNaverSupplySnapshot(base, headers, "investor_time", "kospi"),
      fetchNaverSupplySnapshot(base, headers, "program_time", "kospi"),
      fetchNaverSupplySnapshot(base, headers, "investor_time", "kosdaq"),
      fetchNaverSupplySnapshot(base, headers, "program_time", "kosdaq"),
    ]);

    /* 백엔드에 행이 없으면 success:true·data:null 이 와서 숫자만 전부 0이 됨 → 카드 오해 방지 */
    if (
      !naverJsonHasRows(invKospi) &&
      !naverJsonHasRows(progKospi) &&
      !naverJsonHasRows(invKosdaq) &&
      !naverJsonHasRows(progKosdaq)
    ) {
      return NextResponse.json(errorBody());
    }

    const bizdateForAi =
      invKospi.bizdate ??
      progKospi.bizdate ??
      invKosdaq.bizdate ??
      progKosdaq.bizdate ??
      null;
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

    const result: SupplySummary = {
      success: true,
      mode: "intraday",
      timeLabel: "",
      bizdate: bizdateForAi,
      collectedTime: collectedTimeForAi,
      kospi: {
        ...numsKospi,
        aiSummary:
          aiKospiJson.success && aiKospiJson.ai_summary ? aiKospiJson.ai_summary : null,
      },
      kosdaq: {
        ...numsKosdaq,
        aiSummary:
          aiKosdaqJson.success && aiKosdaqJson.ai_summary ? aiKosdaqJson.ai_summary : null,
      },
    };

    const ct = result.collectedTime ?? "";
    if (ct) {
      const { mode, timeLabel } = timeLabelFromCollectedTime(ct);
      result.mode = mode;
      result.timeLabel = timeLabel;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("수급 요약 조회 오류:", err);
    return NextResponse.json(errorBody(), { status: 500 });
  }
}
