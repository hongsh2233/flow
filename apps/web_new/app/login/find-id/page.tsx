"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Lock } from "lucide-react";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import styles from "../LoginPage.module.css";

export default function FindIdPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maskedEmails, setMaskedEmails] = useState<string[] | null>(null);
  const [fullEmails, setFullEmails] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMaskedEmails(null);
    setFullEmails(null);
    setPassword("");
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/member/find-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMaskedEmails(data.emails || []);
        if (!data.emails?.length) {
          setError("해당 이름으로 등록된 계정이 없습니다.");
        }
      } else {
        setError(data.message || "조회에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/member/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json();
      if (data.success && data.emails?.length) {
        setFullEmails(data.emails);
      } else {
        setError(data.message || "비밀번호가 일치하지 않습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link
            href="/login"
            className={styles.backLink}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className={styles.headerTitle}>아이디 찾기</h1>
          <p className={styles.headerSub}>
            가입 시 입력한 이름으로 이메일을 찾을 수 있습니다.
          </p>
        </div>
        <div className={styles.form}>
          <form onSubmit={handleSearch}>
            <div className={styles.formFields}>
              <FormField
                label="이름"
                type="text"
                placeholder="가입 시 입력한 이름"
                value={name}
                onChange={setName}
                icon={User}
              />
            </div>
            {error && !maskedEmails?.length && (
              <p className={styles.errorMsg}>{error}</p>
            )}
            {!maskedEmails?.length && (
              <Button
                type="submit"
                variant="primary"
                fullWidth
                large
                disabled={loading}
                className={styles.submitBtn}
              >
                {loading ? "조회 중..." : "찾기"}
              </Button>
            )}
          </form>

          {maskedEmails && maskedEmails.length > 0 && (
            <>
              <div className={styles.resultBox}>
                <p className={styles.resultLabel}>등록된 이메일</p>
                {(fullEmails || maskedEmails).map((email, i) => (
                  <p key={i} className={styles.resultEmail}>
                    {email}
                  </p>
                ))}
              </div>

              {!fullEmails && (
                <div style={{ marginTop: "1rem" }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--app-text-muted)", marginBottom: "0.5rem" }}>
                    전체 이메일을 보려면 비밀번호를 입력하세요.
                  </p>
                  <FormField
                    label="비밀번호"
                    type="password"
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={setPassword}
                    icon={Lock}
                  />
                  {error && <p className={styles.errorMsg}>{error}</p>}
                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    large
                    disabled={verifying}
                    className={styles.submitBtn}
                    onClick={handleVerifyPassword}
                  >
                    {verifying ? "확인 중..." : "전체 이메일 보기"}
                  </Button>
                </div>
              )}

              {fullEmails && (
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  large
                  className={styles.submitBtn}
                  onClick={() => router.push("/login")}
                >
                  로그인 하기
                </Button>
              )}
            </>
          )}

          <p className={styles.switchLink}>
            <Link href="/login">로그인</Link> |{" "}
            <Link href="/login/find-password">비밀번호 재설정</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
