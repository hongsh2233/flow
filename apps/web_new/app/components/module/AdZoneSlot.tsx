"use client";

/**
 * AdZoneSlot — B구역 광고 슬롯 (내부 관리 코드, UI 미노출)
 *
 * zone 규칙:
 *   B1 — 메인: 이슈체크와 주요지수 사이        (일반회원까지)
 *   B2 — 메인: 관심종목 아래                    (일반회원까지)
 *   B3 — 브리핑: 탭 버튼과 리스트 사이          (일반회원까지)
 *   B4 — 게시판: 상세보기 위                    (일반회원까지)
 *   B5 — 수급: 수급동향과 수급요약 사이          (VIP회원까지)
 *   B6 — 캘린더: 일정 목록 하단                 (VIP회원까지)
 *   B7 — 주톡: 공부노트와 시장의 목소리 사이     (VIP회원까지)
 */

import { useSession } from "next-auth/react";
import { shouldShowAdZoneB_regular, shouldShowAdZoneB_vip } from "@/lib/affiliate/adZoneB";
import { RandomAffiliateCard } from "./affiliate/RandomAffiliateCard";

export interface AdZoneSlotProps {
  zone: "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7";
}

/** B5·B6·B7 — VIP회원까지 노출 */
const VIP_ZONES = ["B5", "B6", "B7"];

export function AdZoneSlot({ zone }: AdZoneSlotProps) {
  const { data: session, status } = useSession();
  const isVipZone = VIP_ZONES.includes(zone);
  const show = isVipZone
    ? shouldShowAdZoneB_vip(session, status)
    : shouldShowAdZoneB_regular(session, status);

  if (!show) return null;
  return <RandomAffiliateCard zone="B" />;
}
