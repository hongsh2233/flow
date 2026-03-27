"use client";

import { useEffect, useState } from "react";
import { isJurinAppWebView } from "@/lib/hooks/useNotificationSettings";
import { isMobileUserAgent } from "@/lib/device/platform";
import { APP_DOWNLOAD_URL } from "@/lib/config/appDownload";
import styles from "./AppDownloadModal.module.css";

const STORAGE_KEY_SESSION = "app_download_modal_dismissed";
/** 값이 오늘 날짜(로컬 YYYY-MM-DD)와 같으면 당일 숨김 */
const STORAGE_KEY_HIDE_DAY = "app_download_modal_hide_day";

function localDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isHiddenForToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_HIDE_DAY) === localDayKey();
  } catch {
    return false;
  }
}

function setHideForToday() {
  try {
    localStorage.setItem(STORAGE_KEY_HIDE_DAY, localDayKey());
  } catch {
    // ignore
  }
}

function isDismissedSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY_SESSION) === "1";
  } catch {
    return false;
  }
}

function setDismissedSession() {
  try {
    sessionStorage.setItem(STORAGE_KEY_SESSION, "1");
  } catch {
    // ignore
  }
}

export function AppDownloadModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isJurinAppWebView()) return;
    if (!isMobileUserAgent()) return;
    if (isHiddenForToday()) return;
    if (isDismissedSession()) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [visible]);

  if (!visible) return null;

  const handleDownload = () => {
    setDismissedSession();
    setVisible(false);
    window.open(APP_DOWNLOAD_URL, "_blank");
  };

  const handleContinue = () => {
    setDismissedSession();
    setVisible(false);
  };

  const handleHideToday = () => {
    setHideForToday();
    setDismissedSession();
    setVisible(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>플로우 앱으로{"\n"}더 편리하게!</h2>
        <p className={styles.desc}>
          앱에서 더 빠르고 편리하게<br />플로우를 이용해보세요.
        </p>
        <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
          앱 다운로드 받으러 가기
        </button>
        <button type="button" className={styles.continueBtn} onClick={handleContinue}>
          모바일웹으로 계속
        </button>
        <button type="button" className={styles.snoozeTodayBtn} onClick={handleHideToday}>
          오늘 하루 보지 않기
        </button>
      </div>
    </div>
  );
}

export default AppDownloadModal;
