"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "./About.module.css";

const FALLBACK_HTML = `<p>주린이는 주식 투자를 처음 시작하는 분들을 위한 쉽고 친절한 주식 정보 앱입니다.</p>`;

export default function AboutPage() {
  const router = useRouter();
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/legal-documents/about")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.content) setHtml(json.content);
        else setHtml(FALLBACK_HTML);
      })
      .catch(() => setHtml(FALLBACK_HTML))
      .finally(() => setLoading(false));
  }, []);

  const isHtmlContent = html.includes("<");

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.topBarTitle}>주린이 앱</h2>
          <div className={styles.topBarSpacer} />
        </div>

        <div className={styles.body}>
          <div className={styles.heroCard}>
            <div className={styles.appIcon}>📈</div>
            <h1 className={styles.appName}>주린이</h1>
            <p className={styles.appVersion}>v1.0.0</p>
          </div>

          {loading ? (
            <div className={styles.loadingWrap}>불러오는 중...</div>
          ) : (
            <div className={styles.contentCard}>
              {isHtmlContent ? (
                <div
                  className={styles.htmlContent}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <pre className={styles.contentText}>{html}</pre>
              )}
            </div>
          )}

          <p className={styles.copyright}>
            &copy; 2026 Jurini Stock. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
