"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AccessTime from "@mui/icons-material/AccessTime";
import ChevronRight from "@mui/icons-material/ChevronRight";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import type { ScheduleItem, NotifyTiming } from "@/lib/types";
import { useAlarmStore } from "@/lib/stores/useAlarmStore";
import { BottomSheet } from "@/app/components/ui/BottomSheet/BottomSheet";
import { API_BASE_URL } from "@/lib/config/api";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./ScheduleCard.module.css";

const NOTIFY_OPTIONS: { value: NotifyTiming; label: string }[] = [
  { value: "1min", label: "1분 전" },
  { value: "30min", label: "30분 전" },
  { value: "1day", label: "1일 전" },
  { value: "2day", label: "2일 전" },
];

function NotifyButton({
  scheduleId,
  isPast = false,
  onLoginRequired,
}: {
  scheduleId?: number;
  isPast?: boolean;
  onLoginRequired?: () => void;
}) {
  // store에서 직접 현재 알람 상태 구독 (페이지 이동 후 복귀 시에도 유지)
  const selected = useAlarmStore((s) =>
    scheduleId != null ? (s.alarmMap[scheduleId] ?? null) : null
  );
  const { setAlarm, clearAlarm } = useAlarmStore();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleSelect = useCallback(async (value: NotifyTiming) => {
    if (onLoginRequired) {
      onLoginRequired();
      setOpen(false);
      return;
    }
    if (scheduleId == null) return;

    setLoading(true);
    try {
      if (selected === value) {
        // 알림 취소
        await fetch("/api/schedule-alarms", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule_id: scheduleId }),
        });
        clearAlarm(scheduleId);
      } else {
        // 알림 신청
        await fetch("/api/schedule-alarms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule_id: scheduleId, timing: value }),
        });
        setAlarm(scheduleId, value);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }, [scheduleId, selected, onLoginRequired, setAlarm, clearAlarm]);

  const handleToggle = () => {
    if (isPast) {
      alert("지난 일정은 알림을 설정할 수 없습니다.");
      return;
    }
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
        className={`${styles.notifyBtn} ${selected ? styles.notifyBtnActive : ""} ${isPast ? styles.notifyBtnPast : ""}`}
        onClick={handleToggle}
        aria-label="알림 설정"
        disabled={loading}
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
          {selected && (
            <button
              type="button"
              className={styles.notifyOption}
              style={{ color: "var(--color-error, #e53935)", marginTop: "4px" }}
              onClick={() => handleSelect(selected)}
            >
              알림 취소
            </button>
          )}
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
  /** 로그인한 경우에만 알림 버튼 활성화 */
  canUseAlarm?: boolean;
  /** 로그인 여부 (알림 불가 시 메시지 구분용) */
  isLoggedIn?: boolean;
  /** 지난 일정이면 true (알림 아이콘 숨김) */
  isPast?: boolean;
}

/** 일정이 이미 지났는지 확인 (dateIso + time 기준) */
function isSchedulePast(schedule: ScheduleItem): boolean {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dateIso = schedule.dateIso ?? todayStr;
  if (dateIso < todayStr) return true;
  if (dateIso > todayStr) return false;
  if (!schedule.time) return false;
  const [h, m] = schedule.time.split(":").map(Number);
  const scheduleMin = (h ?? 0) * 60 + (m ?? 0);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin > scheduleMin;
}

/** 증권사명 → MTS/홈페이지 URL 매핑 */
const SECURITIES_LINKS: Record<string, string> = {
  "미래에셋증권": "https://securities.miraeasset.com",
  "한국투자증권": "https://www.koreainvestment.com",
  "NH투자증권":   "https://www.nhqv.com",
  "키움증권":     "https://www.kiwoom.com",
  "삼성증권":     "https://www.samsungsecurities.com",
  "KB증권":       "https://www.kbsec.com",
  "하나증권":     "https://www.hanaw.com",
  "신한투자증권": "https://www.shinhaninvestment.com",
  "대신증권":     "https://www.daishin.com",
  "메리츠증권":   "https://www.meritz.co.kr",
  "IBK투자증권":  "https://www.ibks.com",
  "SK증권":       "https://www.sksecurities.com",
  "교보증권":     "https://www.kyobosec.co.kr",
  "한화투자증권": "https://www.hanwhawm.com",
  "유진투자증권": "https://www.eugenefn.com",
  "BNK투자증권":  "https://www.bnkfn.co.kr",
  "DB금융투자":   "https://www.db-fi.com",
  "카카오페이증권": "https://www.kakaopaysec.com",
  "토스증권":     "https://tosssecurities.com",
  "한국포스증권": "https://www.fossec.co.kr",
  "케이프투자증권": "https://www.cape.co.kr",
  "흥국증권":     "https://www.heungkuk.co.kr",
};

/** 텍스트에서 [증권사명] 패턴을 링크/일반 세그먼트로 분리 */
function parseCompanySegments(text: string): Array<{ text: string; url?: string }> {
  const segments: Array<{ text: string; url?: string }> = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    const url = SECURITIES_LINKS[match[1]];
    segments.push({ text: match[0], url });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }
  return segments;
}

/** HTML 내 텍스트에서 증권사명을 <a> 링크로 치환 (detail 본문용) */
function linkifySecuritiesInHtml(html: string): string {
  if (!html) return html;
  let result = html;
  for (const [name, url] of Object.entries(SECURITIES_LINKS)) {
    if (!result.includes(name)) continue;
    // 이미 <a> 태그 안에 있는 경우는 건너뛰기 위해 부정 전후방 탐색 대신 단순 치환
    // (DOMPurify가 중첩 <a>를 정리하므로 안전)
    result = result.replaceAll(
      name,
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`
    );
  }
  return result;
}

/** 제목에서 [증권사명] 패턴 추출 → 없으면 null */
function extractBrokerName(title: string): string | null {
  const m = title.match(/\[([^\]]+)\]/);
  return m ? m[1] : null;
}

export function ScheduleCard({ schedule, canUseAlarm = false, isLoggedIn = false, isPast: isPastProp }: ScheduleCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const rawDetail = schedule.detail != null ? String(schedule.detail) : "";
  const hasDetail = rawDetail.trim().length > 0 && !isEmptyHtml(rawDetail);
  const displayTitle = schedule.title || schedule.subject || "";
  const isPast = isPastProp ?? isSchedulePast(schedule);
  const brokerName = schedule.link_url ? extractBrokerName(displayTitle) : null;
  const linkLabel = brokerName ?? "MTS 바로가기";

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
                {(schedule.company || schedule.content) && (() => {
                  const text = schedule.company || schedule.content || "";
                  const segments = parseCompanySegments(text);
                  const hasLinks = segments.some((s) => s.url);
                  if (!hasLinks) return <p className={styles.company}>{text}</p>;
                  return (
                    <p className={styles.company}>
                      {segments.map((seg, i) =>
                        seg.url ? (
                          <a
                            key={i}
                            href={seg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.companyLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {seg.text}
                          </a>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        )
                      )}
                    </p>
                  );
                })()}
              </div>
              {canUseAlarm ? (
                <NotifyButton scheduleId={schedule.id} isPast={isPast} />
              ) : (
                <NotifyButton
                  scheduleId={schedule.id}
                  isPast={isPast}
                  onLoginRequired={() =>
                    alert("로그인 후 이용할 수 있습니다.")
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
              <div className={styles.bottomRight}>
                {schedule.link_url && (
                  <a
                    href={schedule.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkBtn}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {linkLabel}
                  </a>
                )}
                <p className={styles.date}>{schedule.date}</p>
              </div>
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
                __html: sanitizeHtml(linkifySecuritiesInHtml(rewriteDetailUrls(rawDetail))),
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
