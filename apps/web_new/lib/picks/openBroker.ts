import type { BrokerItem } from "@/app/components/module/picks/BrokerSelectSheet";

export const BROKER_STORAGE_KEY = "selected_broker";

export async function openBrokerApp(b: BrokerItem): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const target = b.deep_link || b.mobile_web || b.android_store;
      if (target) {
        window.location.href = target;
        return;
      }
    }
  } catch {
    /* 웹만 사용 */
  }
  const url = b.mobile_web || b.android_store;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
