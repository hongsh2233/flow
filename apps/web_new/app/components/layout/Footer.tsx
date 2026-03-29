"use client";

import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>
        본 서비스의 모든 정보는 투자 권유가 아니며 정보 제공 목적으로만 제공됩니다.
        투자 판단과 그 결과에 대한 책임은 이용자에게 있습니다.
      </p>
      <div className={styles.links}>
        <Link href="/legal/terms" className={styles.linkBtn}>
          이용약관
        </Link>
        <span className={styles.dot}>·</span>
        <Link href="/legal/privacy" className={styles.linkBtn}>
          개인정보처리방침
        </Link>
      </div>
      <p className={styles.copyright}>© 2026 플로우. All rights reserved.</p>
    </footer>
  );
}
