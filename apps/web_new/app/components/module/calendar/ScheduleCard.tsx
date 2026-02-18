"use client";

import { useState, useRef, useEffect } from "react";
import AccessTime from "@mui/icons-material/AccessTime";
import ChevronRight from "@mui/icons-material/ChevronRight";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import type { ScheduleItem, NotifyTiming } from "@/lib/types";
import { BottomSheet } from "@/app/components/ui/BottomSheet/BottomSheet";
import { API_BASE_URL } from "@/lib/config/api";
import styles from "./ScheduleCard.module.css";

const NOTIFY_OPTIONS: { value: NotifyTiming; label: string }[] = [
  { value: "1min", label: "1분 전" },
  { value: "30min", label: "30분 전" },
  { value: "1day", label: "1일 전" },
  { value: "2day", label: "2일 전" },
];

function NotifyButton({
  onLoginRequired,
}: {
  onLoginRequired?: () => void;
}) {
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
    if (onLoginRequired) {
      onLoginRequired();
      setOpen(false);
      return;
    }
    setSelected(selected === value ? null : value);
    setOpen(false);
  };

  const handleToggle = () => {
    if (onLoginRequired) {
      onLoginRequired();
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className={styles.notifyWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.notifyBtn} ${selected ? styles.notifyBtnActive : ""}`}
        onClick={handleToggle}
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

/** HTML 내 /uploads/ 상대경로를 API 서버 절대경로로 변환 */
function rewriteDetailUrls(html: string): string {
  if (!html || typeof html !== "string") return "";
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return html.replace(
    /(src|href)=(["'])(\/uploads\/[^"']*)/g,
    (_m, attr, quote, path) => `${attr}=${quote}${base}${path}`
  );
}

/** HTML 태그 제거 후 텍스트가 비어있는지 확인 */
function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, "").replace(/\s/g, "");
  return stripped.length === 0;
}

export interface ScheduleCardProps {
  schedule: ScheduleItem;
  /** 설정에서 일정알림을 켰고 로그인한 경우에만 알림 버튼 활성화 */
  canUseAlarm?: boolean;
}

export function ScheduleCard({ schedule, canUseAlarm = false }: ScheduleCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const rawDetail = schedule.detail != null ? String(schedule.detail) : "";
  const hasDetail = rawDetail.trim().length > 0 && !isEmptyHtml(rawDetail);
  const displayTitle = schedule.title || schedule.subject || "";

  return (
    <>
      <div className={styles.card}>
        <div className={styles.inner}>
          <div className={styles.content}>
            <div className={styles.top}>
              <div className={styles.topLeft}>
                <button
                  type="button"
                  className={`${styles.titleBtn} ${hasDetail ? styles.titleBtnClickable : ""}`}
                  onClick={() => hasDetail && setDetailOpen(true)}
                  disabled={!hasDetail}
                >
                  <h4 className={styles.titleText}>{displayTitle}</h4>
                  {hasDetail && (
                    <span className={styles.detailIcon} aria-hidden>
                      <ChevronRight fontSize="small" />
                    </span>
                  )}
                </button>
                {(schedule.company || schedule.content) && (
                  <p className={styles.company}>
                    {schedule.company || schedule.content}
                  </p>
                )}
              </div>
              {canUseAlarm ? (
                <NotifyButton />
              ) : (
                <NotifyButton
                  onLoginRequired={() =>
                    alert("로그인 이후 이용할 수 있습니다.")
                  }
                />
              )}
            </div>
            <div className={styles.bottom}>
              {schedule.time && (
                <div className={styles.timeRow}>
                  <AccessTime fontSize="inherit" />
                  <span className={styles.time}>{schedule.time}</span>
                </div>
              )}
              <p className={styles.date}>{schedule.date}</p>
            </div>
          </div>
        </div>
      </div>

      <BottomSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={displayTitle}
      >
        <div className={styles.detailContentWrap}>
          {hasDetail ? (
            <div
              className={styles.detailContent}
              dangerouslySetInnerHTML={{
                __html: rewriteDetailUrls(rawDetail),
              }}
            />
          ) : (
            <p className={styles.detailEmpty}>상세 내용이 없습니다.</p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
