/**
 * AdZoneSlot — B구역 광고 슬롯 (내부 관리 코드, UI 미노출)
 *
 * 현재는 아무것도 렌더링하지 않습니다.
 * 향후 광고 시스템 연동 시 zone 값에 따라 광고를 렌더링합니다.
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
export interface AdZoneSlotProps {
  zone: "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7";
}

export function AdZoneSlot(_props: AdZoneSlotProps) {
  // 광고 시스템 미연동 상태 — UI에 노출하지 않음
  return null;
}
