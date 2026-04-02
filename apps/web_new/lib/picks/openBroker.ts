import type { BrokerItem } from "@/app/components/module/picks/BrokerSelectSheet";

export const BROKER_STORAGE_KEY = "selected_broker";

/** localStorage에 예전 필드만 있을 때 API 목록으로 보강 */
export function mergeBrokerWithCatalog(stored: BrokerItem, catalog: BrokerItem[]): BrokerItem {
  const hit = catalog.find((x) => x.id === stored.id);
  return hit ? { ...stored, ...hit } : stored;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(navigator.userAgent);
}

function isAndroidUa(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** deep_link 예: samsungpop:// → samsungpop */
function parseUrlScheme(deepLink: string): string | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(deepLink.trim());
  return m ? m[1] : null;
}

/**
 * Android Chrome 등: 앱 미설치 시 Play Store(또는 모바일웹)로 넘어가도록 intent 사용
 * @see https://developer.chrome.com/docs/multidevice/android/intents/
 */
function buildAndroidIntentUrl(b: BrokerItem): string | null {
  const pkg = b.android_package?.trim();
  const deep = b.deep_link?.trim();
  if (!pkg || !deep) return null;
  const scheme = parseUrlScheme(deep);
  if (!scheme) return null;
  const fallbackRaw = b.android_store || b.mobile_web;
  if (!fallbackRaw) return null;
  const fallback = encodeURIComponent(fallbackRaw);
  return `intent://open/#Intent;scheme=${scheme};package=${pkg};S.browser_fallback_url=${fallback};end`;
}

function navigate(href: string): void {
  window.location.assign(href);
}

/** Next 웹 번들은 @capacitor/core 스텁이라 isNativePlatform이 항상 false일 수 있음 → 런타임 주입 객체 사용 */
function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return w.Capacitor?.isNativePlatform?.() === true;
}

/**
 * 증권사 MTS/앱 열기
 * - 모바일 웹: Android는 intent 우선, 그 외는 custom scheme(deep_link)을 같은 창에서 호출 (window.open 금지)
 * - 데스크톱: 모바일웹 새 탭
 * - Capacitor 네이티브: @capacitor/app App.openUrl (WebView에서 스킴 처리 안정적) → intent / deep
 */
export async function openBrokerApp(b: BrokerItem): Promise<void> {
  if (typeof window === "undefined") return;

  const deep = b.deep_link?.trim();
  const mobileWeb = b.mobile_web?.trim();
  const androidStore = b.android_store?.trim();
  const iosStore = b.ios_store?.trim();

  if (isCapacitorNative()) {
    try {
      const { App } = await import("@capacitor/app");
      const intent = isAndroidUa() ? buildAndroidIntentUrl(b) : null;
      const url = intent || deep || mobileWeb || androidStore || iosStore;
      if (url) {
        type AppWithOpenUrl = { openUrl: (opts: { url: string }) => Promise<void> };
        await (App as unknown as AppWithOpenUrl).openUrl({ url });
        return;
      }
    } catch {
      /* 폴백: 아래 일반 웹 로직 */
    }
  }

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      if (isAndroidUa()) {
        const intent = buildAndroidIntentUrl(b);
        if (intent) {
          navigate(intent);
          return;
        }
      }
      const target = deep || mobileWeb || androidStore || iosStore;
      if (target) navigate(target);
      return;
    }
  } catch {
    /* Capacitor 없음 → 순수 웹 */
  }

  if (isMobileBrowser()) {
    if (isAndroidUa()) {
      const intent = buildAndroidIntentUrl(b);
      if (intent) {
        navigate(intent);
        return;
      }
    }
    if (deep) {
      navigate(deep);
      return;
    }
    if (mobileWeb) {
      navigate(mobileWeb);
      return;
    }
    if (iosStore) {
      navigate(iosStore);
      return;
    }
    if (androidStore) {
      navigate(androidStore);
      return;
    }
    return;
  }

  const desktopUrl = mobileWeb || androidStore || iosStore;
  if (desktopUrl) {
    window.open(desktopUrl, "_blank", "noopener,noreferrer");
  }
}
