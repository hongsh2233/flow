"use client";

import { useState, useRef, useEffect } from "react";
import AccessTime from "@mui/icons-material/AccessTime";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import type { ScheduleItem, NotifyTiming } from "@/lib/types";
import styles from "./ScheduleCard.module.css";

const NOTIFY_OPTIONS: { value: NotifyTiming; label: string }[] = [
  { value: "1min", label: "1분 전" },
  { value: "30min", label: "30분 전" },
  { value: "1day", label: "1일 전" },
  { value: "2day", label: "2일 전" },
];

function NotifyButton() {
  const [selected, setSelected] = useState<NotifyTiming | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleSelect = (value: NotifyTiming) => {
    setSelected(selected === value ? null : value);
    setOpen(false);
  };

  return (
    <div className={styles.notifyWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.notifyBtn} ${selected ? styles.notifyBtnActive : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="알림 설정"
      >
        {selected ? (
          <NotificationsActive fontSize="small" />
        ) : (
          <NotificationsNone fontSize="small" />
        )}
      </button>

      {open && (
        <div className={styles.notifyDropdown}>
          <p className={styles.notifyDropdownTitle}>알림 시간 설정</p>
          {NOTIFY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.notifyOption} ${
                selected === opt.value ? styles.notifyOptionActive : ""
              }`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
              {selected === opt.value && (
                <span className={styles.notifyCheck}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ScheduleCardProps {
  schedule: ScheduleItem;
}

export function ScheduleCard({ schedule }: ScheduleCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.top}>
            <div>
              <h4 className={styles.titleText}>{schedule.title}</h4>
              <p className={styles.company}>{schedule.company}</p>
            </div>
            <NotifyButton />
          </div>
          <div className={styles.bottom}>
            <div className={styles.timeRow}>
              <AccessTime fontSize="inherit" />
              <span className={styles.time}>{schedule.time}</span>
            </div>
            <p className={styles.date}>{schedule.date}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
