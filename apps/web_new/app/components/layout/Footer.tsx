"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { TermsTab } from "../ui/TermsModal";
import styles from "./Footer.module.css";

const TermsModal = dynamic(() => import("../ui/TermsModal"), { ssr: false });

export default function Footer() {
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<TermsTab>("privacy");

  const openTerms = (tab: TermsTab) => {
    setTermsTab(tab);
    setTermsOpen(true);
  };

  return (
    <>
      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          본 서비스의 모든 정보는 투자 권유가 아니며 정보 제공 목적으로만 제공됩니다.
          투자 판단과 그 결과에 대한 책임은 이용자에게 있습니다.
        </p>
        <div className={styles.links}>
          <Link href="/faq" className={styles.linkBtn}>고객센터</Link>
          <span className={styles.dot}>·</span>
          <Link href="/about" className={styles.linkBtn}>서비스 소개</Link>
          <span className={styles.dot}>·</span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => openTerms("terms")}
          >
            이용약관
          </button>
          <span className={styles.dot}>·</span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => openTerms("privacy")}
          >
            개인정보처리방침
          </button>
        </div>
        <p className={styles.copyright}>© 2024 플로우. All rights reserved.</p>
      </footer>

      {termsOpen && (
        <TermsModal
          open={termsOpen}
          onClose={() => setTermsOpen(false)}
          viewOnly
          initialTab={termsTab}
        />
      )}
    </>
  );
}

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
