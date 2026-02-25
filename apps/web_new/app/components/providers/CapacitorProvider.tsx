"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useNotificationSettings, isJurinAppWebView } from "@/lib/hooks/useNotificationSettings";
import {
  registerPushNotifications,
  unregisterPushNotifications,
  setupForegroundHandler,
  registerJurinAppPushNotifications,
  unregisterJurinAppPushNotifications,
  saveFcmToken,
} from "@/lib/services/pushNotificationService";

/**
 * 푸시 알림 Provider
 *
 * - Capacitor APK: @capacitor/push-notifications로 FCM 토큰 등록
 * - JurinApp WebView: Android 브릿지(JurinApp.getFcmToken)로 FCM 토큰 등록
 *   + window.__onFcmToken 콜백으로 토큰 갱신 수신
 * - 브라우저: 완전 no-op
 */
export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { pushEnabled } = useNotificationSettings();
  const initialized = useRef(false);

  // Capacitor 포그라운드 핸들러 1회 등록
  useEffect(() => {
    setupForegroundHandler();
  }, []);

  // JurinApp WebView: Android이 FCM 토큰을 발급·갱신할 때 window.__onFcmToken(token) 호출
  // → 백엔드에 자동 저장 (pushEnabled이고 로그인 상태일 때만)
  useEffect(() => {
    if (!isJurinAppWebView()) return;

    const w = window as unknown as {
      __onFcmToken?: (token: string) => void;
    };

    w.__onFcmToken = (token: string) => {
      if (pushEnabled && status === "authenticated" && session?.user?.email) {
        saveFcmToken(token);
      }
    };

    return () => {
      w.__onFcmToken = undefined;
    };
  }, [pushEnabled, status, session]);

  // pushEnabled 변경 시 FCM 토큰 등록/해제
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    if (pushEnabled && !initialized.current) {
      initialized.current = true;
      if (isJurinAppWebView()) {
        registerJurinAppPushNotifications();
      } else {
        registerPushNotifications();
      }
    } else if (!pushEnabled && initialized.current) {
      initialized.current = false;
      if (isJurinAppWebView()) {
        unregisterJurinAppPushNotifications();
      } else {
        unregisterPushNotifications();
      }
    }
  }, [pushEnabled, status, session]);

  return <>{children}</>;
}
