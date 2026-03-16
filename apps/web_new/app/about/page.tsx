"use client";

import { useState, useEffect } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./About.module.css";

const FALLBACK_HTML = `<p>플로우는 주식 투자를 처음 시작하는 분들을 위한 쉽고 친절한 주식 정보 앱입니다.</p>`;

function rewriteUploadUrls(html: string, apiBaseUrl: string): string {
  if (!html || !apiBaseUrl) return html;
  const base = apiBaseUrl.replace(/\/+$/, "");
  return html.replace(/(src|href)=(["'])(\/uploads\/)/g, `$1=$2${base}$3`);
}

export default function AboutPage() {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/legal-documents/about")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.content) {
          const processed = json.api_base_url
            ? rewriteUploadUrls(json.content, json.api_base_url)
            : json.content;
          setHtml(processed);
        } else {
          setHtml(FALLBACK_HTML);
        }
      })
      .catch(() => setHtml(FALLBACK_HTML))
      .finally(() => setLoading(false));
  }, []);

  const isHtmlContent = html.includes("<");

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        <div className={styles.body}>

          {loading ? (
            <div className={styles.loadingWrap}>불러오는 중...</div>
          ) : (
            <div className={styles.contentCard}>
              {isHtmlContent ? (
                <div
                  className={styles.htmlContent}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
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
