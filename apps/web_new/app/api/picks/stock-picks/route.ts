import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";
import { sessionToPicksTier, stockPickVisibleRankCount } from "@/lib/picks/gradeTier";

export const dynamic = "force-dynamic";

type PickRow = {
  id: number;
  stock_code: string;
  stock_name: string;
  entry_price: number;
  entry_date: string;
  is_closed?: boolean;
  note?: string | null;
  order_index?: number;
};

function maskPick(p: PickRow, tier: ReturnType<typeof sessionToPicksTier>, index: number): PickRow {
  if (tier === "family") return { ...p };
  if (tier === "guest") {
    return {
      ...p,
      stock_code: "***",
      stock_name: "***",
      note: null,
    };
  }
  const cap = stockPickVisibleRankCount(tier);
  if (cap != null && index < cap) return { ...p };
  return {
    ...p,
    stock_code: "***",
    stock_name: "***",
    note: null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const tier = sessionToPicksTier(session);

  if (!API_BASE_URL || !API_SECRET_KEY) {
    return NextResponse.json({ success: true, picks: [], tier });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/stock-picks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_SECRET_KEY,
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      return NextResponse.json({ success: true, picks: [], tier });
    }

    if (!res.ok) {
      return NextResponse.json({ success: true, picks: [], tier });
    }

    const raw = (await res.json()) as { success?: boolean; picks?: PickRow[] };
    const list = Array.isArray(raw.picks) ? raw.picks : [];
    const masked = list.map((p, i) => maskPick(p, tier, i));

    return NextResponse.json({
      success: true,
      picks: masked,
      tier,
    });
  } catch {
    return NextResponse.json({ success: true, picks: [], tier });
  }
}
