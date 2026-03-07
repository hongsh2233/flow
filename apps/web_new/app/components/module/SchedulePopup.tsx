"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./SchedulePopup.module.css";

const STORAGE_KEY_PREFIX = "schedule_popup_hidden_";

interface ScheduleItem {
  id: number;
  date: string;
  end_date: string | null;
  scheduled_time: string;
  subject: string;
  content: string;
  detail: string;
  type: string;
  link_url: string | null;
}

function getTodayKey(): string {
  if (typeof window === "undefined") return "";
  const kr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kr.getFullYear()}-${String(kr.getMonth() + 1).padStart(2, "0")}-${String(kr.getDate()).padStart(2, "0")}`;
}

function getHiddenToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = getTodayKey();
    return localStorage.getItem(STORAGE_KEY_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function hideToday() {
  try {
    const key = getTodayKey();
    localStorage.setItem(STORAGE_KEY_PREFIX + key, "1");
  } catch {
    // ignore
  }
}

const TYPE_LABELS: Record<string, string> = {
  earnings: "실적발표",
  ipo: "공모청약",
  dividend: "배당",
  news: "소식",
  api: "공휴일",
  etc: "기타",
  manual: "기타",
};

export function SchedulePopup() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getHiddenToday()) return;

    fetch("/api/schedules/today-popup")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success || !result.data?.length) return;
        setSchedules(result.data);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  const handleClose = useCallback((todayHide: boolean) => {
    if (todayHide) hideToday();
    setVisible(false);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose(false);
    },
    [handleClose]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) handleClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleClose]);

  if (!visible || schedules.length === 0) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>📌 중요 일정</h3>
          <button className={styles.closeBtn} onClick={() => handleClose(false)} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {schedules.map((item) => (
            <div key={item.id} className={styles.scheduleItem}>
              <div className={styles.scheduleSubject}>{item.subject}</div>
              <div className={styles.scheduleMeta}>
                {item.date}
                {item.scheduled_time && ` ${item.scheduled_time}`}
                {item.type && (
                  <span style={{ marginLeft: "0.5rem" }}>
                    [{TYPE_LABELS[item.type] || item.type}]
                  </span>
                )}
              </div>
              {item.content && (
                <div className={styles.scheduleContent}>{item.content}</div>
              )}
              {item.link_url && (
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.scheduleLink}
                >
                  자세히 보기 →
                </a>
              )}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.todayHide} onClick={() => handleClose(true)}>
            <span className={styles.checkbox}>□</span>
            오늘 하루 보지 않기
          </button>
          <button className={styles.closeText} onClick={() => handleClose(false)}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchedulePopup;
