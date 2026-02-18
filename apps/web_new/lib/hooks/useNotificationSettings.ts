"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_SCHEDULE_ALARM = "schedule_alarm_enabled";
const STORAGE_KEY_PUSH = "push_notification_enabled";

export function useNotificationSettings() {
  const [scheduleAlarmEnabled, setScheduleAlarmEnabledState] = useState(false);
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const s = localStorage.getItem(STORAGE_KEY_SCHEDULE_ALARM);
      const p = localStorage.getItem(STORAGE_KEY_PUSH);
      setScheduleAlarmEnabledState(s === "true");
      setPushEnabledState(p === "true");
    } catch {
      // ignore
    }
  }, []);

  const setScheduleAlarmEnabled = useCallback((v: boolean) => {
    setScheduleAlarmEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY_SCHEDULE_ALARM, String(v));
    } catch {
      // ignore
    }
  }, []);

  const setPushEnabled = useCallback((v: boolean) => {
    setPushEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY_PUSH, String(v));
    } catch {
      // ignore
    }
  }, []);

  return {
    scheduleAlarmEnabled: mounted ? scheduleAlarmEnabled : false,
    pushEnabled: mounted ? pushEnabled : false,
    setScheduleAlarmEnabled,
    setPushEnabled,
  };
}
