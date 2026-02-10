"use client";

import { BarChart3, Mail, Lock, User } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { SocialLoginButton } from "../components/ui/SocialLoginButton";
import type { SocialProvider } from "@/lib/types";
import styles from "./SignupPage.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 실제 회원가입 API 연동
    router.push("/login");
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
          <p className={styles.headerSub}>지금 가입하고 투자를 시작하세요</p>
        </div>

        <div className={styles.form}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formFields}>
              <FormField
                label="이름"
                type="text"
                placeholder="주린이"
                value={name}
                onChange={setName}
                icon={User}
              />
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

            <Button
              type="submit"
              variant="primary"
              fullWidth
              large
              className={styles.submitBtn}
            >
              회원가입
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

          <p className={styles.loginLink}>
            이미 계정이 있으신가요? <Link href="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
