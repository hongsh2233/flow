import { NextRequest, NextResponse } from "next/server";

interface YahooFinanceResponse {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        symbol: string;
        shortName?: string;
      };
    }>;
    error?: unknown;
  };
}

/**
 * 환율 - Yahoo Finance 직접 호출 (BO 경유 아님)
 */
const EXCHANGE_RATES = [
  { name: "미국 USD", symbol: "KRW=X", currency: "USD" },
  { name: "일본 JPY (100엔)", symbol: "JPYKRW=X", currency: "JPY" },
  { name: "유럽 EUR", symbol: "EURKRW=X", currency: "EUR" },
];

async function fetchRate(item: { name: string; symbol: string; currency: string }) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1d&range=1d`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${item.symbol}:`, response.status, response.statusText);
      return null;
    }

    const data: YahooFinanceResponse = await response.json();

    if (data.chart.error || !data.chart.result || data.chart.result.length === 0) {
      console.error("Error in response for", item.symbol, data.chart.error);
      return null;
    }

    const result = data.chart.result[0];
    if (!result?.meta) {
      console.error("Invalid data structure for", item.symbol);
      return null;
    }

    const meta = result.meta;
    const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? meta.previousClose;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;

    if (price == null || isNaN(price)) {
      console.error("Invalid price for", item.symbol);
      return null;
    }

    let displayPrice = price;
    let prevPrice = prev ?? price;

    // JPY: 100엔 단위 표기
    if (item.symbol === "JPYKRW=X" && price < 20) {
      displayPrice = price * 100;
      prevPrice = (prev ?? price) * 100;
    }

    const change = displayPrice - prevPrice;
    const percent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;

    return {
      currency: item.currency,
      rate: displayPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      change: change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2),
      isPositive: change >= 0,
    };
  } catch (error) {
    console.error(`Error fetching ${item.symbol}:`, error);
    return null;
  }
}

export async function GET(_request: NextRequest) {
  try {
    const promises = EXCHANGE_RATES.map((item) => fetchRate(item));
    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is NonNullable<typeof r> => r != null);

    return NextResponse.json({
      success: true,
      data: validResults,
    });
  } catch (error) {
    console.error("Exchange Rate API Error:", error);
    return NextResponse.json(
      { success: false, message: "환율 정보를 가져오는데 실패했습니다.", data: [] },
      { status: 500 }
    );
  }
}
