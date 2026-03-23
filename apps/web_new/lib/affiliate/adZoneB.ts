import type { Session } from "next-auth";

/**
 * B구역 광고 슬롯 — 내부 관리 코드
 *
 * B1~B3 (일반회원까지): 비회원·일반 노출 / VIP·Family 미노출
 * B4~B6 (VIP회원까지): 비회원·일반·VIP 노출 / Family 미노출
 */

/** B1~B3: 일반회원까지 노출 */
export function shouldShowAdZoneB_regular(
  session: Session | null,
  authStatus: "loading" | "authenticated" | "unauthenticated"
): boolean {
  if (authStatus === "loading") return false;
  if (authStatus === "unauthenticated" || !session?.user) return true;
  const grade = (session.user as { grade?: string }).grade ?? "regular";
  if (grade === "vip" || grade === "family") return false;
  return true;
}

/** B4~B6: VIP회원까지 노출 (Family만 제외) */
export function shouldShowAdZoneB_vip(
  session: Session | null,
  authStatus: "loading" | "authenticated" | "unauthenticated"
): boolean {
  if (authStatus === "loading") return false;
  if (authStatus === "unauthenticated" || !session?.user) return true;
  const grade = (session.user as { grade?: string }).grade ?? "regular";
  if (grade === "family") return false;
  return true;
}

/** 서버 컴포넌트용: B1~B3 */
export function shouldShowAdZoneB_regularServer(session: Session | null): boolean {
  return shouldShowAdZoneB_regular(
    session,
    session ? "authenticated" : "unauthenticated"
  );
}

/** 서버 컴포넌트용: B4~B6 */
export function shouldShowAdZoneB_vipServer(session: Session | null): boolean {
  return shouldShowAdZoneB_vip(
    session,
    session ? "authenticated" : "unauthenticated"
  );
}
