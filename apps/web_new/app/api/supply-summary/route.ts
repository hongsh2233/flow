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

interface SupplySummary {
  success: boolean;
  mode: "intraday" | "closing";
  timeLabel: string;
  bizdate: string | null;
  collectedTime: string | null;
  foreign: number;
  individual: number;
  institution: number;
  programArbitrage: number;
  programNonArbitrage: number;
  aiSummary: string | null;
}

export async function GET() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_SECRET_KEY) {
    headers["X-API-KEY"] = API_SECRET_KEY;
  }

  try {
    const [investorRes, programRes, aiRes] = await Promise.all([
      fetch(
        `${API_BASE_URL}/api/naver-supply-data?data_type=investor_time&market=all`,
        { method: "GET", headers, cache: "no-store" }
      ),
      fetch(
        `${API_BASE_URL}/api/naver-supply-data?data_type=program_time&market=all`,
        { method: "GET", headers, cache: "no-store" }
      ),
      fetch(`${API_BASE_URL}/api/supply-summary-ai`, { method: "GET", headers, cache: "no-store" }),
    ]);

    if (!investorRes.ok || !programRes.ok) {
      return NextResponse.json({
        success: false,
        mode: "intraday",
        timeLabel: "",
        bizdate: null,
        collectedTime: null,
        foreign: 0,
        individual: 0,
        institution: 0,
        programArbitrage: 0,
        programNonArbitrage: 0,
        aiSummary: null,
      });
    }

    const aiJson = aiRes.ok ? await aiRes.json() : { success: false, ai_summary: null };

    const investorJson = await investorRes.json();
    const programJson = await programRes.json();

    const investorData = investorJson.data;
    const programData = programJson.data;

    const result: SupplySummary = {
      success: true,
      mode: "intraday",
      timeLabel: "",
      bizdate: investorJson.bizdate ?? programJson.bizdate ?? null,
      collectedTime: investorJson.collected_time ?? programJson.collected_time ?? null,
      foreign: 0,
      individual: 0,
      institution: 0,
      programArbitrage: 0,
      programNonArbitrage: 0,
      aiSummary: aiJson.success && aiJson.ai_summary ? aiJson.ai_summary : null,
    };

    const collectedTime = result.collectedTime ?? "";
    const hour = parseInt(collectedTime.split(":")[0] || "0", 10);
    const minute = parseInt(collectedTime.split(":")[1] || "0", 10);

    if (hour >= 15 && (hour > 15 || minute >= 30)) {
      result.mode = "closing";
      result.timeLabel = "금일 15:30분 정규장 마감 기준";
    } else {
      const prevH = minute >= 30 ? hour : hour - 1;
      const prevM = minute >= 30 ? 0 : 30;
      const currH = minute >= 30 ? hour : hour;
      const currM = minute >= 30 ? 30 : 0;
      result.timeLabel = `현재 ${String(prevH).padStart(2, "0")}:${String(prevM).padStart(2, "0")}~${String(currH).padStart(2, "0")}:${String(currM).padStart(2, "0")} 기준`;
    }

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

    return NextResponse.json(result);
  } catch (err) {
    console.error("수급 요약 조회 오류:", err);
    return NextResponse.json(
      {
        success: false,
        mode: "intraday",
        timeLabel: "",
        bizdate: null,
        collectedTime: null,
        foreign: 0,
        individual: 0,
        institution: 0,
        programArbitrage: 0,
        programNonArbitrage: 0,
        aiSummary: null,
      },
      { status: 500 }
    );
  }
}
