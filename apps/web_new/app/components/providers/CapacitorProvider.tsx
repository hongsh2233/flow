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
  const { pushEnabled, setPushEnabled } = useNotificationSettings();
  const initialized = useRef(false);

  // 최신 상태를 ref로 유지 (콜백 클로저에서 stale closure 방지)
  const pushEnabledRef = useRef(pushEnabled);
  const statusRef = useRef(status);
  const sessionRef = useRef(session);

  useEffect(() => { pushEnabledRef.current = pushEnabled; }, [pushEnabled]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Capacitor 포그라운드 핸들러 1회 등록
  useEffect(() => {
    setupForegroundHandler();
  }, []);

  // JurinApp WebView: Android이 FCM 토큰을 발급·갱신할 때 window.__onFcmToken(token) 호출
  // → 콜백을 한 번만 등록하고 ref를 통해 최신 상태 참조 (레이스 컨디션 방지)
  useEffect(() => {
    if (!isJurinAppWebView()) return;

    const w = window as unknown as {
      __onFcmToken?: (token: string) => void;
      __onNotificationPermission?: (granted: boolean) => void;
    };

    // FCM 토큰 갱신 콜백: pushEnabled와 무관하게 항상 저장 (로그인 불필요)
    w.__onFcmToken = (token: string) => {
      if (pushEnabledRef.current) {
        saveFcmToken(token);
      }
    };

    // 최초 실행 시 Android 알림 권한 허용 → pushEnabled 자동 활성화
    // (기존에 콜백이 없으면 Android에서 호출해도 무시되던 문제 수정)
    if (!w.__onNotificationPermission) {
      w.__onNotificationPermission = (granted: boolean) => {
        if (granted && !pushEnabledRef.current) {
          setPushEnabled(true);
        }
      };
    }

    return () => {
      w.__onFcmToken = undefined;
    };
  }, []); // 빈 deps: 콜백은 한 번만 등록, 내부에서 ref로 최신 상태 참조

  // pushEnabled 변경 시 FCM 토큰 등록/해제 (로그인 여부 무관)
  useEffect(() => {
    if (status === "loading") return;  // 세션 로딩 중엔 대기

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
  }, [pushEnabled, status]);

  // 로그인 완료 시 email을 기존 토큰에 연동 (재등록으로 email 갱신)
  useEffect(() => {
    if (status === "authenticated" && session?.user?.email && pushEnabled && initialized.current) {
      if (isJurinAppWebView()) {
        registerJurinAppPushNotifications();
      } else {
        registerPushNotifications();
      }
    }
  }, [status, session?.user?.email]);

  return <>{children}</>;
}
