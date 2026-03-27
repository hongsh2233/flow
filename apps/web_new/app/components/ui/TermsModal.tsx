"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from "@/lib/data/terms";
import styles from "./TermsModal.module.css";

export type TermsTab = "privacy" | "terms";

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
  /** 동의 모드에서만 사용 (viewOnly가 아닐 때) */
  onAgree?: () => void;
  /** true이면 열람 전용 (닫기 버튼만 표시) */
  viewOnly?: boolean;
  /** 처음 열릴 때 보여줄 탭 */
  initialTab?: TermsTab;
}

export default function TermsModal({
  open,
  onClose,
  onAgree,
  viewOnly = false,
  initialTab = "privacy",
}: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<TermsTab>(initialTab);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyContent, setPrivacyContent] = useState(PRIVACY_POLICY);
  const [termsContent, setTermsContent] = useState(TERMS_OF_SERVICE);

  useEffect(() => {
    fetch("/api/legal-documents/privacy")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.content) setPrivacyContent(json.content);
      })
      .catch(() => {});
    fetch("/api/legal-documents/terms")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.content) setTermsContent(json.content);
      })
      .catch(() => {});
  }, []);

  // 열릴 때마다 initialTab으로 리셋
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      if (viewOnly) return;
      setPrivacyRead(false);
      setTermsRead(false);
    }
  }, [open, initialTab, viewOnly]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (viewOnly) return;
    const el = e.currentTarget;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    if (isBottom) {
      if (activeTab === "privacy") setPrivacyRead(true);
      if (activeTab === "terms") setTermsRead(true);
    }
  };

  const allRead = privacyRead && termsRead;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {viewOnly
              ? activeTab === "privacy"
                ? "개인정보 처리방침"
                : "이용약관"
              : "약관 동의"}
          </h3>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "privacy" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            개인정보보호정책
            {!viewOnly && privacyRead && <span className={styles.readBadge}>확인</span>}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "terms" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("terms")}
          >
            이용약관
            {!viewOnly && termsRead && <span className={styles.readBadge}>확인</span>}
          </button>
        </div>

        <div className={styles.content} onScroll={handleScroll}>
          <pre className={styles.contentText}>
            {activeTab === "privacy" ? privacyContent : termsContent}
          </pre>
        </div>

        {!viewOnly && !allRead && (
          <p className={styles.hint}>
            각 약관을 끝까지 스크롤하여 읽어주세요.
          </p>
        )}

        <div className={styles.modalFooter}>
          {viewOnly ? (
            <Button
              variant="primary"
              onClick={onClose}
              className={styles.footerBtn}
            >
              닫기
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={onClose}
                className={styles.footerBtn}
              >
                취소
              </Button>
              <Button
                variant="primary"
                disabled={!allRead}
                onClick={onAgree}
                className={styles.footerBtn}
              >
                동의하기
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
