import type { Session } from "next-auth";

/** API·UI 공통: 스크리닝·추천종목 마스킹 구간 */
export type PicksGradeTier = "guest" | "member" | "vip" | "family";

function normalizeGrade(grade: string | undefined | null): string {
  return (grade ?? "regular").trim().toLowerCase();
}

export function sessionToPicksTier(session: Session | null): PicksGradeTier {
  if (!session?.user) return "guest";
  const g = normalizeGrade((session.user as { grade?: string }).grade);
  if (g === "family") return "family";
  if (g === "vip") return "vip";
  return "member";
}

export function gradeStringToPicksTier(grade: string | undefined | null): PicksGradeTier {
  const g = normalizeGrade(grade);
  if (!grade?.trim()) return "guest";
  if (g === "family") return "family";
  if (g === "vip") return "vip";
  return "member";
}

/**
 * AI 스크리닝 표: 비회원은 공개 행 없음(0), 일반 2·VIP 5·Family 전체
 * @returns null 이면 전 행 공개, 0이면 비회원(표시 행 없음 — applyScreeningMask에서 [])
 */
export function screeningVisibleRankCount(tier: PicksGradeTier): number | null {
  if (tier === "family") return null;
  if (tier === "guest") return 0;
  if (tier === "member") return 2;
  if (tier === "vip") return 5;
  return 2;
}

/**
 * 추천종목(stock-picks): 비회원은 전 행 마스킹, 일반 2·VIP 5·Family 전체
 * @returns null 이면 전 행 공개, 0이면 비회원(전 행 마스킹 전용)
 */
export function stockPickVisibleRankCount(tier: PicksGradeTier): number | null {
  if (tier === "family") return null;
  if (tier === "guest") return 0;
  if (tier === "member") return 2;
  if (tier === "vip") return 5;
  return 2;
}
