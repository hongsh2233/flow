"use client";

import { BarChart3, Mail, Lock, User, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { SocialLoginButton } from "../components/ui/SocialLoginButton";
import TermsModal from "../components/ui/TermsModal";
import type { SocialProvider } from "@/lib/types";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";
import styles from "./SignupPage.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailChecked, setEmailChecked] = useState<boolean | null>(null);
  const [emailCheckMsg, setEmailCheckMsg] = useState("");
  const [emailChecking, setEmailChecking] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingProvider = useRef<SocialProvider | null>(null);

  const fetchRandomNickname = useCallback(async () => {
    setNicknameLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/generate-nickname`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setNickname(data.nickname);
      }
    } catch {
      // 실패 시 기본값
      setNickname("주린이");
    } finally {
      setNicknameLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomNickname();
  }, [fetchRandomNickname]);

  // 이메일 변경 시 중복체크 상태 초기화
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailChecked(null);
    setEmailCheckMsg("");
  };

  // 이메일 중복 체크
  const handleCheckEmail = async () => {
    if (!email) {
      setEmailCheckMsg("이메일을 입력해주세요.");
      setEmailChecked(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailCheckMsg("올바른 이메일 형식이 아닙니다.");
      setEmailChecked(false);
      return;
    }

    setEmailChecking(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/auth/check-email?email=${encodeURIComponent(email)}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        setEmailChecked(data.available);
        setEmailCheckMsg(data.message);
      }
    } catch {
      setEmailCheckMsg("이메일 확인 중 오류가 발생했습니다.");
      setEmailChecked(false);
    } finally {
      setEmailChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) return;
    if (emailChecked !== true) {
      setError("이메일 중복확인을 해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/member/signup`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password, nickname }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "회원가입에 실패했습니다.");
        return;
      }

      // 회원가입 성공 → 자동 로그인
      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.ok) {
        router.push("/");
        router.refresh();
      } else {
        // 로그인 실패 시 로그인 페이지로 이동
        router.push("/login");
      }
    } catch {
      setError("서버 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
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

          {error && <p className={styles.errorMsg}>{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className={styles.formFields}>
              <div className={styles.nicknameRow}>
                <div className={styles.nicknameField}>
                  <FormField
                    label="닉네임"
                    type="text"
                    placeholder="닉네임 생성 중..."
                    value={nickname}
                    onChange={() => {}}
                    icon={User}
                    readOnly
                  />
                </div>
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={fetchRandomNickname}
                  disabled={nicknameLoading}
                  aria-label="닉네임 새로고침"
                >
                  <RefreshCw
                    size={18}
                    className={nicknameLoading ? styles.spinning : ""}
                  />
                </button>
              </div>
              <div className={styles.emailRow}>
                <div className={styles.emailField}>
                  <FormField
                    label="이메일"
                    type="email"
                    placeholder="jurini@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    icon={Mail}
                  />
                </div>
                <button
                  type="button"
                  className={styles.checkEmailBtn}
                  onClick={handleCheckEmail}
                  disabled={emailChecking || !email}
                >
                  {emailChecking ? "확인중..." : "중복확인"}
                </button>
              </div>
              {emailCheckMsg && (
                <div className={`${styles.emailCheckMsg} ${emailChecked ? styles.emailAvailable : styles.emailUnavailable}`}>
                  {emailChecked ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>{emailCheckMsg}</span>
                </div>
              )}
              <FormField
                label="비밀번호"
                type="password"
                placeholder="8자 이상 입력"
                value={password}
                onChange={setPassword}
                icon={Lock}
              />
              <FormField
                label="비밀번호 확인"
                type="password"
                placeholder="비밀번호 재입력"
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
              disabled={!termsAgreed || submitting}
              className={styles.submitBtn}
            >
              {submitting ? "가입 중..." : "회원가입"}
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
