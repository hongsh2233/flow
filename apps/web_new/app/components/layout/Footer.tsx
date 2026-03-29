"use client";

import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.root} aria-label="법적 고지">
      <p className={styles.disclaimer}>
        본 서비스의 주식·시장 정보는 참고용이며 투자 권유가 아닙니다. 투자 판단과 책임은 투자자 본인에게 있습니다.
      </p>
    </footer>
  );
}
