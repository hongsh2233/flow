"use client";

import { useEffect, useState } from "react";
import { isJurinAppWebView } from "@/lib/hooks/useNotificationSettings";
import styles from "./AppDownloadModal.module.css";

const STORAGE_KEY = "app_download_modal_dismissed";
const APP_STORE_URL = "https://drive.google.com/file/d/1OPpLClDGnbXoAGGOWVn4alZXbLAr8JUB/view?usp=drivesdk";

function isMobileBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export function AppDownloadModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isJurinAppWebView()) return;
    if (!isMobileBrowser()) return;
    if (isDismissed()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const handleDownload = () => {
    setDismissed();
    setVisible(false);
    window.open(APP_STORE_URL, "_blank");
  };

  const handleContinue = () => {
    setDismissed();
    setVisible(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconWrap}>
          <img src="/images/icon-192.png" alt="주리니 앱 아이콘" className={styles.appIcon} />
        </div>
        <h2 className={styles.title}>주리니 앱으로{"\n"}더 편리하게!</h2>
        <p className={styles.desc}>
          앱에서 더 빠르고 편리하게<br />주리니를 이용해보세요.
        </p>
        <button className={styles.downloadBtn} onClick={handleDownload}>
          앱 다운로드 받으러 가기
        </button>
        <button className={styles.continueBtn} onClick={handleContinue}>
          모바일웹으로 계속
        </button>
      </div>
    </div>
  );
}

export default AppDownloadModal;
