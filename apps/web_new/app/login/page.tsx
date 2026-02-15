"use client";

import { BarChart3, Mail, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { SocialLoginButton } from "../components/ui/SocialLoginButton";
import type { SocialProvider } from "@/lib/types";
import styles from "./LoginPage.module.css";

const LAST_LOGIN_KEY = "lastLoginProvider";
type LoginMethod = "credentials" | "kakao" | "naver" | "google";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastLoginProvider, setLastLoginProvider] = useState<LoginMethod | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LAST_LOGIN_KEY) as LoginMethod | null;
      if (stored && ["credentials", "kakao", "naver", "google"].includes(stored)) {
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

  const handleSocialLogin = (provider: SocialProvider) => {
    signIn(provider, { callbackUrl: "/" });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <div className={styles.iconBox}>
              <BarChart3 aria-hidden />
            </div>
          </div>
          <h1 className={styles.headerTitle}>주리니</h1>
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
                  비밀번호 찾기
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
            <SocialLoginButton
              provider="kakao"
              onClick={() => handleSocialLogin("kakao")}
              recent={lastLoginProvider === "kakao"}
            />
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
