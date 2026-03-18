"use client";

import { BarChart3, Mail, Lock, Home } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { SocialLoginButton } from "../components/ui/SocialLoginButton";
import type { SocialProvider } from "@/lib/types";
import styles from "./LoginPage.module.css";

const LAST_LOGIN_KEY = "lastLoginProvider";
type LoginMethod = "credentials" | "kakao" | "naver" | "google";

export default function LoginPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastLoginProvider, setLastLoginProvider] = useState<LoginMethod | null>(null);
  const browserListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LAST_LOGIN_KEY) as LoginMethod | null;
      if (stored && ["credentials", "naver", "google"].includes(stored)) {
        setLastLoginProvider(stored);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("이메일 또는 비밀번호를 확인해주세요.");
      } else if (result?.ok) {
        localStorage.setItem(LAST_LOGIN_KEY, "credentials");
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("서버 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    // Capacitor 네이티브 앱에서는 Chrome Custom Tab을 사용해 OAuth 수행
    // Google/Naver는 WebView에서 OAuth를 차단하므로 시스템 브라우저를 통해 인증
    if (Capacitor.isNativePlatform()) {
      try {
        setSubmitting(true);
        setError("");

        // 서버에서 OAuth URL 획득
        const res = await fetch(
          `/api/auth/get-oauth-url/${provider}?callbackUrl=${encodeURIComponent("/auth/mobile-callback")}`
        );
        const data = await res.json();

        if (!data.url) {
          throw new Error("OAuth URL을 가져오지 못했습니다.");
        }

        const { Browser } = await import("@capacitor/browser");
        const { App } = await import("@capacitor/app");

        // Chrome Custom Tab에서 OAuth 페이지 열기
        await Browser.open({ url: data.url, presentationStyle: "popover" });

        // 로그인 완료 후 처리 (한 번만 실행되도록 플래그 사용)
        let handled = false;
        const finish = async () => {
          if (handled) return;
          handled = true;
          urlListener?.remove();
          finishedListener?.remove();
          browserListenerRef.current = null;
          // 세션 쿠키가 WebView와 공유되므로 세션 업데이트
          await updateSession();
          localStorage.setItem(LAST_LOGIN_KEY, provider);
          router.push("/");
          router.refresh();
          setSubmitting(false);
        };

        // 딥링크(com.jurini.app://auth/callback)로 앱이 복귀할 때 처리
        // mobile-callback 페이지가 딥링크로 리다이렉트하면 OS가 앱을 열고 이 이벤트가 발동
        const urlListener = await App.addListener("appUrlOpen", async ({ url }) => {
          if (url.startsWith("com.jurini.app://auth/callback")) {
            await Browser.close().catch(() => {});
            await finish();
          }
        });

        // 사용자가 Custom Tab을 수동으로 닫을 경우 fallback
        const finishedListener = await Browser.addListener("browserFinished", async () => {
          await finish();
        });

        browserListenerRef.current = { remove: () => { urlListener.remove(); finishedListener.remove(); } };
      } catch (err) {
        console.error("소셜 로그인 오류:", err);
        setError("소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
        setSubmitting(false);
      }
      return;
    }

    // 웹 브라우저: 기존 NextAuth 방식
    signIn(provider, { callbackUrl: "/" });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.backLink} aria-label="홈으로">
            <Home size={20} />
          </Link>
          <div className={styles.iconWrap}>
            <div className={styles.iconBox}>
              <BarChart3 aria-hidden />
            </div>
          </div>
          <h1 className={styles.headerTitle}>플로우</h1>
          <p className={styles.headerSub}>초보 투자자를 위한 친절한 주식 앱</p>
        </div>

        <div className={styles.form}>
          <div className={styles.formTitleRow}>
            <h2 className={styles.formTitle}>로그인</h2>
            {lastLoginProvider === "credentials" && (
              <span className={styles.recentBadge}>최근 로그인</span>
            )}
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className={styles.formFields}>
              <FormField
                label="이메일"
                type="email"
                placeholder="jurini@example.com"
                value={email}
                onChange={setEmail}
                icon={Mail}
              />
              <FormField
                label="비밀번호"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={setPassword}
                icon={Lock}
              />
            </div>

            <div className={styles.options}>
              <label className={styles.checkboxWrap}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>로그인 상태 유지</span>
              </label>
              <div className={styles.findLinks}>
                <Link href="/login/find-id" className={styles.forgotLink}>
                  아이디 찾기
                </Link>
                <span className={styles.findSep}>|</span>
                <Link href="/login/find-password" className={styles.forgotLink}>
                  비밀번호 재설정
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              large
              disabled={submitting}
              className={styles.submitBtn}
            >
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <div className={styles.dividerText}>
              <span>또는</span>
            </div>
          </div>

          <div className={styles.socialButtons}>
            {/* 카카오 로그인 비활성화
            <SocialLoginButton
              provider="kakao"
              onClick={() => handleSocialLogin("kakao")}
              recent={lastLoginProvider === "kakao"}
            />
            */}
            <SocialLoginButton
              provider="naver"
              onClick={() => handleSocialLogin("naver")}
              recent={lastLoginProvider === "naver"}
            />
            <SocialLoginButton
              provider="google"
              onClick={() => handleSocialLogin("google")}
              recent={lastLoginProvider === "google"}
            />
          </div>

          <p className={styles.switchLink}>
            아직 계정이 없으신가요?{" "}
            <Link href="/signup">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
