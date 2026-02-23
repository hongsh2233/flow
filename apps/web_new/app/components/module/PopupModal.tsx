"use client";

import { useEffect, useState, useCallback } from "react";
import { getImageUrl } from "@/lib/config/api";
import styles from "./PopupModal.module.css";

interface PopupData {
  id: number;
  title: string;
  content_type: "html" | "image";
  html_content: string | null;
  image_url: string | null;
  link_url: string | null;
}

const STORAGE_KEY = "popup_hidden_today";

function getHiddenIds(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (now - v < 24 * 60 * 60 * 1000) cleaned[k] = v;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function hidePopupToday(id: number) {
  const data = getHiddenIds();
  data[String(id)] = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isHiddenToday(id: number): boolean {
  const data = getHiddenIds();
  return !!data[String(id)];
}

export function PopupModal() {
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [todayChecked, setTodayChecked] = useState(false);

  useEffect(() => {
    fetch("/api/popups/active")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          const visible = (result.data as PopupData[]).filter(
            (p) => !isHiddenToday(p.id)
          );
          setPopups(visible);
        }
      })
      .catch(() => {});
  }, []);

  const current = popups[currentIndex];

  const handleClose = useCallback(() => {
    if (todayChecked && current) {
      hidePopupToday(current.id);
    }
    const remaining = popups.filter((_, i) => i !== currentIndex);
    if (remaining.length > 0) {
      setPopups(remaining);
      setCurrentIndex(0);
      setTodayChecked(false);
    } else {
      setPopups([]);
    }
  }, [popups, currentIndex, todayChecked, current]);

  const handleTodayHideAndClose = useCallback(() => {
    if (current) hidePopupToday(current.id);
    const remaining = popups.filter((_, i) => i !== currentIndex);
    if (remaining.length > 0) {
      setPopups(remaining);
      setCurrentIndex(0);
      setTodayChecked(false);
    } else {
      setPopups([]);
    }
  }, [popups, currentIndex, current]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose]
  );

  const handleImageClick = useCallback(() => {
    if (current?.link_url) {
      window.open(current.link_url, "_blank", "noopener,noreferrer");
    }
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && popups.length > 0) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popups, handleClose]);

  if (popups.length === 0 || !current) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>{current.title}</h3>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {current.content_type === "html" && current.html_content ? (
            <div
              className={styles.htmlContent}
              dangerouslySetInnerHTML={{ __html: current.html_content }}
            />
          ) : current.content_type === "image" && current.image_url ? (
            <img
              src={getImageUrl(current.image_url)}
              alt={current.title}
              className={styles.imageContent}
              onClick={handleImageClick}
            />
          ) : null}
        </div>

        {popups.length > 1 && (
          <div className={styles.indicator}>
            {popups.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ""}`}
                onClick={() => { setCurrentIndex(i); setTodayChecked(false); }}
                aria-label={`팝업 ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.todayHide} onClick={handleTodayHideAndClose}>
            <span className={`${styles.checkbox} ${todayChecked ? styles.checkboxChecked : ""}`}>
              {todayChecked && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            오늘 하루 보지 않기
          </button>
          <button className={styles.closeText} onClick={handleClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default PopupModal;
