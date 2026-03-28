import type { Session } from "next-auth";

/** API·UI 공통: 스크리닝 마스킹 구간 */
export type PicksGradeTier = "guest" | "member_limited" | "family";

export function sessionToPicksTier(session: Session | null): PicksGradeTier {
  if (!session?.user) return "guest";
  const g = (session.user as { grade?: string }).grade ?? "regular";
  if (g === "family") return "family";
  return "member_limited";
}

export function gradeStringToPicksTier(grade: string | undefined | null): PicksGradeTier {
  if (!grade) return "guest";
  if (grade === "family") return "family";
  return "member_limited";
}
