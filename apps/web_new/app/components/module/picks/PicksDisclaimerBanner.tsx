"use client";

import styles from "./Picks.module.css";

export function PicksDisclaimerBanner() {
  return (
    <div className={styles.banner} role="note">
      <p className={styles.bannerLine}>
        본 AI 추천 정보는 투자권유가 아니며, 투자 판단과 책임은 투자자 본인에게 있습니다.
      </p>
      <p className={styles.bannerNoRooms}>
        <strong className={styles.bannerNoRoomsStrong}>
          플로우는 투자 리딩방, 단톡방을 운영하지 않습니다.
        </strong>
      </p>
    </div>
  );
}
