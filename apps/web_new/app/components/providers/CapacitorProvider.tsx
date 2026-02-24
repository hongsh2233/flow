"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useNotificationSettings } from "@/lib/hooks/useNotificationSettings";
import {
  registerPushNotifications,
  unregisterPushNotifications,
  setupForegroundHandler,
} from "@/lib/services/pushNotificationService";

/**
 * Capacitor APK 전용 Provider
 * - pushEnabled 상태에 따라 FCM 토큰 등록/해제
 * - 포그라운드 알림 핸들러 등록
 * - 브라우저 환경에서는 완전 no-op
 */
export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { pushEnabled } = useNotificationSettings();
  const initialized = useRef(false);

  // 포그라운드 핸들러 1회 등록
  useEffect(() => {
    setupForegroundHandler();
  }, []);

  // pushEnabled 변경 시 FCM 토큰 등록/해제
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    if (pushEnabled && !initialized.current) {
      initialized.current = true;
      registerPushNotifications();
    } else if (!pushEnabled && initialized.current) {
      initialized.current = false;
      unregisterPushNotifications();
    }
  }, [pushEnabled, status, session]);

  return <>{children}</>;
}
