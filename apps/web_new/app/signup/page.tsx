"use client";

import { BarChart3, Mail, Lock, User } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import styles from "./SignupPage.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 실제 회원가입 API 연동
    router.push("/login");
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
              <FormField
                label="비밀번호 확인"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={setConfirmPassword}
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

          <p className={styles.switchLink}>
            이미 계정이 있으신가요?{" "}
            <Link href="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
