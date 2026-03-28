"use client";

import styles from "./Picks.module.css";

export function PicksDisclaimerBanner() {
  return (
    <div className={styles.banner} role="note">
      본 AI 추천 정보는 투자권유가 아니며, 투자 판단과 책임은 투자자 본인에게 있습니다.
    </div>
  );
}
