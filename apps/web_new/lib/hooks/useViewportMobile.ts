"use client";

import { useEffect, useState } from "react";

/**
 * 뷰포트 너비 기준 mo (CSS 미디어쿼리와 동일한 방식).
 * PC에서 창을 좁히면 true가 될 수 있음 — “기기”가 아니라 “화면 폭” 구분.
 */
export function useIsNarrowViewport(maxWidthPx: number = 768): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidthPx]);

  return narrow;
}
