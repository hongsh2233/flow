"use client";

import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>
        플로우가 제공하는 모든 정보는 투자 참고용으로만 제공되며 특정 주식 매매를 추천하거나 투자 결정의
        유일한 근거로 사용되어서는 안 됩니다.
      </p>
      <p className={styles.disclaimer}>
        모든 투자에는 원금 손실 위험이 따르므로 투자 전 개인의 투자목표와 위험성향을 신중히 고려하여 본인
        판단에 따라 투자하시기 바라며, 당사는 제공된 정보로 인한 투자 결과에 대해 법적 책임을 지지 않습니다.
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
