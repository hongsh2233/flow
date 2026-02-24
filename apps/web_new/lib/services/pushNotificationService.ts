/**
 * Capacitor FCM 푸시 알림 서비스
 *
 * Capacitor 환경(Android APK)에서만 동작하며,
 * 웹 브라우저에서는 모든 함수가 안전하게 no-op 처리됩니다.
 */

/** Capacitor 환경인지 확인 */
function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

/** FCM 토큰을 백엔드에 등록 */
async function saveFcmToken(token: string): Promise<void> {
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

/** FCM 토큰을 백엔드에서 삭제 (알림 OFF 시) */
async function deleteFcmToken(token: string): Promise<void> {
  try {
    await fetch("/api/fcm-token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* ignore */
  }
}

/** Capacitor 푸시 알림 권한 요청 및 토큰 등록 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isCapacitor()) return null;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // 권한 요청
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      console.warn("[FCM] 푸시 알림 권한 거부됨");
      return null;
    }

    // 토큰 등록
    await PushNotifications.register();

    return new Promise((resolve) => {
      // 토큰 수신
      PushNotifications.addListener("registration", async (token) => {
        console.log("[FCM] 토큰 등록:", token.value.slice(0, 20) + "...");
        await saveFcmToken(token.value);
        resolve(token.value);
      });

      // 등록 실패
      PushNotifications.addListener("registrationError", (error) => {
        console.error("[FCM] 토큰 등록 실패:", error);
        resolve(null);
      });

      // 10초 타임아웃
      setTimeout(() => resolve(null), 10_000);
    });
  } catch (e) {
    console.error("[FCM] 초기화 실패:", e);
    return null;
  }
}

/** 포그라운드 알림 핸들러 등록 */
export async function setupForegroundHandler(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // 앱이 열려 있는 상태에서 알림 수신
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[FCM] 포그라운드 알림:", notification.title);
      // 커스텀 이벤트 발행 → Header에서 수신하여 알림 갱신
      window.dispatchEvent(new CustomEvent("fcm-notification", { detail: notification }));
    });

    // 알림 클릭 (백그라운드/종료 상태에서 수신 후 클릭)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const link = action.notification.data?.link_url as string | undefined;
      if (link && typeof window !== "undefined") {
        window.location.href = link;
      }
    });
  } catch (e) {
    console.error("[FCM] 핸들러 등록 실패:", e);
  }
}

/** 푸시 알림 해제 (설정 OFF 시) */
export async function unregisterPushNotifications(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    // 현재 등록된 토큰 가져오기 위해 다시 등록 후 삭제
    // Capacitor는 토큰 직접 조회 API가 없으므로 재등록 후 삭제 처리
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
