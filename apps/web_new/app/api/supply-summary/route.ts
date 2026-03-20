import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

function parseNum(val: string): number {
  const s = String(val).replace(/,/g, "").replace(/\+/g, "").trim();
  if (!s || s === "-") return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

interface NaverSupplyResponse {
  success: boolean;
  data: { headers: string[]; rows: string[][] } | null;
  bizdate: string | null;
  collected_time?: string | null;
}

/**
 * 홈페이지 수급 요약 카드용 API
 * 기존 /api/naver-supply-data 엔드포인트(이미 존재)를 호출해 파싱 → SupplySummary 구조 반환
 * 새 백엔드 엔드포인트에 의존하지 않으므로 백엔드 재시작 없이 동작
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market") ?? "kospi";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_SECRET_KEY) {
      headers["X-API-KEY"] = API_SECRET_KEY;
    }

    const fetchBackend = async (params: string): Promise<NaverSupplyResponse> => {
      const res = await fetch(`${API_BASE_URL}/api/naver-supply-data?${params}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (!res.ok) return { success: false, data: null, bizdate: null };
      return res.json();
    };

    // 1. 투자자별 매매동향 (investor_day)
    const invJson = await fetchBackend(`data_type=investor_day&market=${encodeURIComponent(market)}`);
    if (!invJson.success || !invJson.data?.rows?.length) {
      return NextResponse.json({ success: false, message: "수급 데이터 없음" });
    }

    const invRow = invJson.data.rows[0];
    // 열 순서: 날짜(0), 개인(1), 외국인(2), 기관계(3), ...
    const individual = parseNum(invRow[1] ?? "0");
    const foreign = parseNum(invRow[2] ?? "0");
    const institution = parseNum(invRow[3] ?? "0");

    // 2. 프로그램 매매 (program_day)
    let programArbitrage = 0;
    let programNonArbitrage = 0;
    const progJson = await fetchBackend(`data_type=program_day&market=${encodeURIComponent(market)}`);
    if (progJson.success && progJson.data?.rows?.length) {
      const progRow = progJson.data.rows[0];
      // 열 순서: 날짜(0), 차익매수(1), 차익매도(2), 차익순매수(3),
      //           비차익매수(4), 비차익매도(5), 비차익순매수(6), ...
      programArbitrage = parseNum(progRow[3] ?? "0");
      programNonArbitrage = parseNum(progRow[6] ?? "0");
    }

    // 3. 메타
    const collectedTime = invJson.collected_time ?? "";
    const bizdate = invJson.bizdate;
    const hhmm = collectedTime ? parseInt(collectedTime.replace(":", ""), 10) : 0;
    const mode = hhmm >= 1530 ? "closing" : "intraday";
    const marketLabel = market === "kospi" ? "코스피" : "코스닥";
    const timeLabel =
      mode === "closing"
        ? `${marketLabel} 장 마감 수급`
        : collectedTime
        ? `${marketLabel} 장중 수급 (${collectedTime} 기준)`
        : `${marketLabel} 수급`;

    return NextResponse.json({
      success: true,
      market,
      mode,
      timeLabel,
      bizdate,
      collectedTime,
      foreign,
      individual,
      institution,
      programArbitrage,
      programNonArbitrage,
      aiSummary: null,
    });
  } catch (error) {
    console.warn("supply-summary API 오류:", error);
    return NextResponse.json({ success: false, message: "수급 요약 조회 실패" });
  }
}
