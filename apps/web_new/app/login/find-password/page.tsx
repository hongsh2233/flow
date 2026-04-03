"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, User } from "lucide-react";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import styles from "../LoginPage.module.css";

type Step = "email" | "verify" | "done";

export default function FindPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/member/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNameHint(data.name_hint || "");
        setStep("verify");
      } else {
        setError(data.message || "요청에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/member/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("done");
      } else {
        setError(data.message || data.detail || "비밀번호 변경에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.headerTitle}>비밀번호 변경 완료</h1>
            <p className={styles.headerSub}>
              비밀번호가 성공적으로 변경되었습니다.
            </p>
          </div>
          <div className={styles.form}>
            <Button
              variant="primary"
              fullWidth
              large
              onClick={() => router.push("/login")}
              className={styles.submitBtn}
            >
              로그인하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/login" className={styles.backLink} aria-label="뒤로가기">
            <ArrowLeft size={20} />
          </Link>
          <h1 className={styles.headerTitle}>비밀번호 재설정</h1>
          <p className={styles.headerSub}>
            {step === "email"
              ? "가입한 이메일을 입력해주세요."
              : "본인 확인을 위해 이름을 입력하고 새 비밀번호를 설정해주세요."}
          </p>
        </div>
        <div className={styles.form}>
          {step === "email" ? (
            <form onSubmit={handleCheckEmail}>
              <div className={styles.formFields}>
                <FormField
                  label="이메일"
                  type="email"
                  placeholder="가입 시 사용한 이메일"
                  value={email}
                  onChange={setEmail}
                  icon={Mail}
                />
              </div>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                large
                disabled={loading}
                className={styles.submitBtn}
              >
                {loading ? "확인 중..." : "다음"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className={styles.formFields}>
                <FormField
                  label="이메일"
                  type="email"
                  placeholder=""
                  value={email}
                  onChange={() => {}}
                  icon={Mail}
                  readOnly
                />
                {nameHint && (
                  <p style={{ fontSize: "0.85rem", color: "var(--app-text-muted)", margin: "0.25rem 0 0.5rem" }}>
                    이름 힌트: <strong>{nameHint}</strong>
                  </p>
                )}
                <FormField
                  label="이름"
                  type="text"
                  placeholder="가입 시 입력한 이름"
                  value={name}
                  onChange={setName}
                  icon={User}
                />
                <FormField
                  label="새 비밀번호"
                  type="password"
                  placeholder="8자 이상 입력"
                  value={newPassword}
                  onChange={setNewPassword}
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
              {error && <p className={styles.errorMsg}>{error}</p>}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                large
                disabled={loading}
                className={styles.submitBtn}
              >
                {loading ? "변경 중..." : "비밀번호 변경"}
              </Button>
            </form>
          )}
          <p className={styles.switchLink}>
            <Link href="/login">로그인</Link> |{" "}
            <Link href="/login/find-id">아이디 찾기</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
