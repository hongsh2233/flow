"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_SCHEDULE_ALARM = "schedule_alarm_enabled";
const STORAGE_KEY_PUSH = "push_notification_enabled";

/** JurinApp Android WebView 환경 감지 */
export function isJurinAppWebView(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as { JurinApp?: unknown }).JurinApp !== "undefined";
}

/**
 * JurinApp Android 브릿지를 통해 알림 권한을 요청합니다.
 * 권한 결과는 window.__onNotificationPermission(granted) 콜백으로 전달됩니다.
 * @returns Promise<boolean> 권한 허용 여부
 */
export function requestAndroidNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isJurinAppWebView()) {
      resolve(true); // 네이티브 앱이 아닌 경우 웹 브라우저 처리
      return;
    }

    const bridge = (window as unknown as { JurinApp?: { requestNotificationPermission: () => void; isNotificationPermissionGranted: () => boolean } }).JurinApp;
    if (!bridge) {
      resolve(true);
      return;
    }

    // 이미 권한이 있으면 바로 반환
    if (bridge.isNotificationPermissionGranted()) {
      resolve(true);
      return;
    }

    // 콜백 등록 후 Android에 권한 요청
    const timeout = setTimeout(() => {
      (window as unknown as { __onNotificationPermission?: unknown }).__onNotificationPermission = undefined;
      resolve(false);
    }, 30_000);

    (window as unknown as { __onNotificationPermission: (granted: boolean) => void }).__onNotificationPermission = (granted: boolean) => {
      clearTimeout(timeout);
      (window as unknown as { __onNotificationPermission?: unknown }).__onNotificationPermission = undefined;
      resolve(granted);
    };

    bridge.requestNotificationPermission();
  });
}

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
