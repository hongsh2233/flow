"use client";

import { useMemo } from "react";
import { isMobileUserAgent } from "@/lib/device/platform";
import { isJurinAppWebView } from "@/lib/hooks/useNotificationSettings";

/**
 * 클라이언트에서 접속 맥락을 한 번에 구분.
 * - jurin-app: Android JurinApp WebView
 * - mo-web: 일반 모바일 브라우저 UA
 * - pc-web: 그 외(데스크톱 브라우저 등)
 */
export type ClientAccessChannel = "jurin-app" | "mo-web" | "pc-web";

export function useClientAccessHint(): {
  channel: ClientAccessChannel;
  isJurinApp: boolean;
  isMobileUa: boolean;
} {
  return useMemo(() => {
    const isJurinApp = isJurinAppWebView();
    const isMobileUa = isMobileUserAgent();
    const channel: ClientAccessChannel = isJurinApp
      ? "jurin-app"
      : isMobileUa
        ? "mo-web"
        : "pc-web";
    return { channel, isJurinApp, isMobileUa };
  }, []);
}
