"use client";

import styles from "./JuTalkPage.module.css";

export default function JuTalkPage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.placeholder}>
        <p className={styles.message}>
          주톡 서비스 준비 중입니다.
          <br />
          커뮤니티가 곧 찾아옵니다!
        </p>
      </div>
    </div>
  );
}
