"use client";

import { BarChart3, Mail, Lock, User } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { SocialLoginButton } from "../components/ui/SocialLoginButton";
import type { SocialProvider } from "@/lib/types";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 실제 이메일/비밀번호 인증 API 연동
    router.push("/");
    router.refresh();
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
          <div className={styles.tabGroup}>
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`${styles.tab} ${!isSignUp ? styles.tabActive : styles.tabInactive}`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`${styles.tab} ${isSignUp ? styles.tabActive : styles.tabInactive}`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formFields}>
              {isSignUp && (
                <FormField
                  label="이름"
                  type="text"
                  placeholder="주린이"
                  value={name}
                  onChange={setName}
                  icon={User}
                />
              )}
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

            {!isSignUp && (
              <div className={styles.options}>
                <label className={styles.checkboxWrap}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>로그인 상태 유지</span>
                </label>
                <button type="button" className={styles.forgotLink}>
                  비밀번호 찾기
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              large
              className={styles.submitBtn}
            >
              {isSignUp ? "회원가입" : "로그인"}
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
            />
            <SocialLoginButton
              provider="naver"
              onClick={() => handleSocialLogin("naver")}
            />
            <SocialLoginButton
              provider="google"
              onClick={() => handleSocialLogin("google")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
