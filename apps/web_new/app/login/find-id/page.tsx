"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import styles from "../LoginPage.module.css";

export default function FindIdPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmails(null);
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
        setEmails(data.emails || []);
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
          <form onSubmit={handleSubmit}>
            <div className={styles.formFields}>
              <FormField
                label="이름"
                type="text"
                placeholder="이름 입력"
                value={name}
                onChange={setName}
                icon={User}
              />
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
            {emails && emails.length > 0 && (
              <div className={styles.resultBox}>
                <p className={styles.resultLabel}>등록된 이메일</p>
                {emails.map((email, i) => (
                  <p key={i} className={styles.resultEmail}>
                    {email}
                  </p>
                ))}
              </div>
            )}
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
          </form>
          <p className={styles.switchLink}>
            <Link href="/login">로그인</Link> |{" "}
            <Link href="/login/find-password">비밀번호 찾기</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
