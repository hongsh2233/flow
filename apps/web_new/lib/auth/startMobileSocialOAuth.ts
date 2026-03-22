"use client";

import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import type { SocialProvider } from "@/lib/types";

const LAST_LOGIN_KEY = "lastLoginProvider";

type RouterLike = { push: (href: string) => void; refresh: () => void };

/**
 * Capacitor 네이티브 / JurinApp Android WebView / 일반 웹 브라우저에 맞춰 소셜 OAuth를 시작한다.
 * Google은 WebView 직접 로딩 시 차단되므로 앱 환경에서는 Custom Tab 경로를 사용한다.
 */
export async function startMobileSocialOAuth(options: {
  provider: SocialProvider;
  /** OAuth 완료 후 Custom Tab에서 열리는 앱 전용 콜백 (기본: /auth/mobile-callback) */
  mobileCallbackPath?: string;
  setSubmitting: (loading: boolean) => void;
  setError: (message: string) => void;
  router: RouterLike;
  /** Capacitor 앱에서 세션 반영용 */
  updateSession: () => Promise<unknown>;
  /** 일반 웹에서 signIn에 넘길 callbackUrl */
  webCallbackUrl?: string;
}): Promise<void> {
  const mobileCallback = options.mobileCallbackPath ?? "/auth/mobile-callback";
  const webCb = options.webCallbackUrl ?? "/";

  const fetchOAuthUrl = async () => {
    const res = await fetch(
      `/api/auth/get-oauth-url/${options.provider}?callbackUrl=${encodeURIComponent(mobileCallback)}`
    );
    const data = (await res.json()) as { url?: string; error?: string };
    if (!data.url) {
      throw new Error(data.error || "OAuth URL을 가져오지 못했습니다.");
    }
    return data.url;
  };

  if (Capacitor.isNativePlatform()) {
    try {
      options.setSubmitting(true);
      options.setError("");
      const url = await fetchOAuthUrl();
      const { Browser } = await import("@capacitor/browser");
      const { App } = await import("@capacitor/app");
      await Browser.open({ url, presentationStyle: "popover" });

      let handled = false;
      let urlListener: { remove: () => void } | null = null;
      let finishedListener: { remove: () => void } | null = null;

      const finish = async () => {
        if (handled) return;
        handled = true;
        urlListener?.remove();
        finishedListener?.remove();
        await options.updateSession();
        try {
          localStorage.setItem(LAST_LOGIN_KEY, options.provider);
        } catch {
          // ignore
        }
        options.router.push("/");
        options.router.refresh();
        options.setSubmitting(false);
      };

      urlListener = await App.addListener("appUrlOpen", async ({ url: openUrl }) => {
        if (openUrl.startsWith("com.jurini.app://auth/callback")) {
          await Browser.close().catch(() => {});
          await finish();
        }
      });

      finishedListener = await Browser.addListener("browserFinished", async () => {
        await finish();
      });
    } catch (err) {
      console.error("소셜 로그인 오류:", err);
      options.setError("소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      options.setSubmitting(false);
    }
    return;
  }

  const jurinApp =
    typeof window !== "undefined"
      ? (window as unknown as { JurinApp?: { openAuthBrowser?: (u: string) => void } }).JurinApp
      : undefined;

  if (jurinApp?.openAuthBrowser) {
    try {
      options.setSubmitting(true);
      options.setError("");
      const url = await fetchOAuthUrl();
      jurinApp.openAuthBrowser(url);
    } catch (err) {
      console.error("소셜 로그인 오류:", err);
      options.setError("소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      options.setSubmitting(false);
    }
    return;
  }

  signIn(options.provider, { callbackUrl: webCb });
}
