"use client";

import { BarChart3, Mail, Lock, User } from "lucide-react";
import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { SocialLoginButton } from "../components/ui/SocialLoginButton";
import TermsModal from "../components/ui/TermsModal";
import type { SocialProvider } from "@/lib/types";
import styles from "./SignupPage.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [nickname] = useState("주린이");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const pendingProvider = useRef<SocialProvider | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) return;
    // TODO: 실제 회원가입 API 연동
    router.push("/login");
  };

  const handleSocialSignup = (provider: SocialProvider) => {
    if (termsAgreed) {
      signIn(provider, { callbackUrl: "/" });
    } else {
      pendingProvider.current = provider;
      setTermsModalOpen(true);
    }
  };

  const handleAgree = () => {
    setTermsAgreed(true);
    setTermsModalOpen(false);

    if (pendingProvider.current) {
      signIn(pendingProvider.current, { callbackUrl: "/" });
      pendingProvider.current = null;
    }
  };

  const handleModalClose = () => {
    setTermsModalOpen(false);
    pendingProvider.current = null;
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
          <h2 className={styles.formTitle}>회원가입</h2>

          <form onSubmit={handleSubmit}>
            <div className={styles.formFields}>
              <FormField
                label="닉네임"
                type="text"
                placeholder="주린이"
                value={nickname}
                onChange={() => {}}
                icon={User}
                readOnly
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
              <FormField
                label="비밀번호 확인"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={setConfirmPassword}
                icon={Lock}
              />
            </div>

            <div className={styles.termsSection}>
              <label className={styles.termsLabel}>
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  readOnly
                  className={styles.termsCheckbox}
                />
                <span className={styles.termsText}>
                  개인정보보호정책 및 이용약관에 동의합니다.
                </span>
              </label>
              <button
                type="button"
                className={styles.termsViewBtn}
                onClick={() => setTermsModalOpen(true)}
              >
                약관 보기
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              large
              disabled={!termsAgreed}
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
              onClick={() => handleSocialSignup("kakao")}
            />
            <SocialLoginButton
              provider="naver"
              onClick={() => handleSocialSignup("naver")}
            />
            <SocialLoginButton
              provider="google"
              onClick={() => handleSocialSignup("google")}
            />
          </div>

          <p className={styles.switchLink}>
            이미 계정이 있으신가요?{" "}
            <Link href="/login">로그인</Link>
          </p>
        </div>
      </div>

      <TermsModal
        open={termsModalOpen}
        onClose={handleModalClose}
        onAgree={handleAgree}
      />
    </div>
  );
}
