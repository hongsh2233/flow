/**
 * 일정 알림 구독 전역 상태 (Zustand)
 * - Calendar, NotifyButton 등 어디서든 알림 설정 현황 참조 가능
 */

import { create } from "zustand";
import type { NotifyTiming } from "@/lib/types";

interface AlarmState {
  /** schedule_id → timing 맵 */
  alarmMap: Record<number, NotifyTiming>;
  /** 서버에서 최초 fetch 완료 여부 */
  fetched: boolean;
  /** 서버에서 알림 구독 목록 조회 후 alarmMap 갱신 */
  fetchAlarms: () => Promise<void>;
  /** 알림 신청 성공 후 즉시 반영 */
  setAlarm: (scheduleId: number, timing: NotifyTiming) => void;
  /** 알림 취소 성공 후 즉시 반영 */
  clearAlarm: (scheduleId: number) => void;
  /** 로그아웃 시 초기화 */
  reset: () => void;
}

export const useAlarmStore = create<AlarmState>((set) => ({
  alarmMap: {},
  fetched: false,

  fetchAlarms: async () => {
    try {
      const res = await fetch("/api/schedule-alarms");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const map: Record<number, NotifyTiming> = {};
        for (const sub of data.data) {
          if (sub.notified === "false") {
            map[sub.schedule_id] = sub.timing as NotifyTiming;
          }
        }
        set({ alarmMap: map, fetched: true });
      }
    } catch {
      set({ fetched: true });
    }
  },

  setAlarm: (scheduleId, timing) =>
    set((s) => ({ alarmMap: { ...s.alarmMap, [scheduleId]: timing } })),

  clearAlarm: (scheduleId) =>
    set((s) => {
      const next = { ...s.alarmMap };
      delete next[scheduleId];
      return { alarmMap: next };
    }),

  reset: () => set({ alarmMap: {}, fetched: false }),
}));
