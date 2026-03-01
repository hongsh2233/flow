/**
 * 푸시 알림 서비스
 *
 * - Capacitor(APK) 환경: @capacitor/push-notifications 사용
 * - JurinApp WebView 환경: Android 브릿지(JurinApp.getFcmToken) 사용
 * - 웹 브라우저: 모든 함수가 안전하게 no-op 처리
 */

type JurinAppBridge = {
  getFcmToken: () => string;
  isNotificationPermissionGranted: () => boolean;
  requestNotificationPermission: () => void;
  getAppVersion: () => string;
};

/** Capacitor 환경인지 확인 */
function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
}

/** JurinApp Android WebView 환경인지 확인 */
function isJurinAppWebView(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as { JurinApp?: unknown }).JurinApp !== "undefined";
}

function getJurinAppBridge(): JurinAppBridge | null {
  if (!isJurinAppWebView()) return null;
  return (window as unknown as { JurinApp?: JurinAppBridge }).JurinApp ?? null;
}

// ──────────────────────────────────────────────────────────────
// 공통: 백엔드 토큰 등록/삭제
// ──────────────────────────────────────────────────────────────

/** FCM 토큰을 백엔드에 등록 */
export async function saveFcmToken(token: string): Promise<void> {
  try {
    await fetch("/api/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* ignore */
  }
}

/** FCM 토큰을 백엔드에서 삭제 (알림 OFF 시)
 * token 없으면 로그인된 email의 모든 토큰 삭제
 */
export async function deleteFcmToken(token?: string): Promise<void> {
  try {
    await fetch("/api/fcm-token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { token } : {}),
    });
  } catch {
    /* ignore */
  }
}

// ──────────────────────────────────────────────────────────────
// JurinApp WebView 전용
// ──────────────────────────────────────────────────────────────

/**
 * JurinApp WebView: Android 브릿지에서 FCM 토큰을 읽어 백엔드에 등록
 * 토큰이 아직 없으면 null 반환 (나중에 window.__onFcmToken 콜백으로 수신)
 */
export async function registerJurinAppPushNotifications(): Promise<string | null> {
  const bridge = getJurinAppBridge();
  if (!bridge) return null;

  const token = bridge.getFcmToken();
  if (!token) return null;

  await saveFcmToken(token);
  return token;
}

/** JurinApp WebView: FCM 토큰 백엔드 삭제 (알림 OFF)
 * 토큰을 얻지 못해도 email 기반으로 서버에서 전체 삭제 시도
 */
export async function unregisterJurinAppPushNotifications(): Promise<void> {
  const bridge = getJurinAppBridge();
  if (!bridge) return;

  const token = bridge.getFcmToken();
  // 토큰이 있으면 특정 토큰만, 없으면 email로 전체 삭제 (server-side에서 email 기반 삭제)
  await deleteFcmToken(token || undefined);
}

// ──────────────────────────────────────────────────────────────
// Capacitor 전용
// ──────────────────────────────────────────────────────────────

/** Capacitor 푸시 알림 권한 요청 및 토큰 등록 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isCapacitor()) return null;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      console.warn("[FCM] 푸시 알림 권한 거부됨");
      return null;
    }

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        await saveFcmToken(token.value);
        resolve(token.value);
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("[FCM] 토큰 등록 실패:", error);
        resolve(null);
      });

      setTimeout(() => resolve(null), 10_000);
    });
  } catch (e) {
    console.error("[FCM] 초기화 실패:", e);
    return null;
  }
}

/** 포그라운드 알림 핸들러 등록 (Capacitor 전용) */
export async function setupForegroundHandler(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      window.dispatchEvent(new CustomEvent("fcm-notification", { detail: notification }));
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const link = action.notification.data?.link_url as string | undefined;
      if (link) window.location.href = link;
    });
  } catch (e) {
    console.error("[FCM] 핸들러 등록 실패:", e);
  }
}

/** 푸시 알림 해제 (Capacitor, 설정 OFF 시) */
export async function unregisterPushNotifications(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.register();

    await new Promise<void>((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        await deleteFcmToken(token.value);
        resolve();
      });
      setTimeout(resolve, 5_000);
    });
  } catch {
    /* ignore */
  }
}
