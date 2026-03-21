import type { Session } from "next-auth";

/**
 * A구역(제휴 광고): 일반 회원·비회원만 노출.
 * VIP·Family 등급은 노출하지 않음.
 */
export function shouldShowAdZoneA(session: Session | null, authStatus: "loading" | "authenticated" | "unauthenticated"): boolean {
  if (authStatus === "loading") return false;
  if (authStatus === "unauthenticated" || !session?.user) return true;
  const grade = (session.user as { grade?: string }).grade ?? "regular";
  if (grade === "vip" || grade === "family") return false;
  return true;
}

/** 서버(getServerSession): 로딩 상태 없음 — 세션 유무로만 구분 */
export function shouldShowAdZoneAServer(session: Session | null): boolean {
  return shouldShowAdZoneA(session, session ? "authenticated" : "unauthenticated");
}
