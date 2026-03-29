"use client";

import { useEffect, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from "@/lib/data/terms";
import styles from "../LegalDocument.module.css";

const TITLES: Record<"privacy" | "terms", string> = {
  privacy: "개인정보처리방침",
  terms: "이용약관",
};

const FALLBACK_TEXT: Record<"privacy" | "terms", string> = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_OF_SERVICE,
};

function rewriteUploadUrls(html: string, apiBaseUrl: string): string {
  if (!html || !apiBaseUrl) return html;
  const base = apiBaseUrl.replace(/\/+$/, "");
  return html.replace(/(src|href)=(["'])(\/uploads\/)/g, `$1=$2${base}$3`);
}

export function LegalDocumentClient({ docType }: { docType: "privacy" | "terms" }) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/legal-documents/${docType}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.content) {
          const processed = json.api_base_url
            ? rewriteUploadUrls(json.content, json.api_base_url)
            : json.content;
          setHtml(processed);
        } else {
          setHtml(FALLBACK_TEXT[docType]);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(FALLBACK_TEXT[docType]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docType]);

  const isHtmlContent = html.includes("<");

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        <div className={styles.body}>
          <h1 className={styles.title}>{TITLES[docType]}</h1>
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
        </div>
      </div>
    </div>
  );
}
