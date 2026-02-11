"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import PinKeypad from "./PinKeypad";
import {
  verifyPin,
  incrementAttempts,
  resetAttempts,
  getLockRemaining,
  MAX_ATTEMPTS,
  getAttempts,
} from "@/lib/utils/pin";
import styles from "./PinLockScreen.module.css";

interface PinLockScreenProps {
  onUnlock: () => void;
}

export default function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [lockRemaining, setLockRemaining] = useState(0);

  // 잠금 타이머
  useEffect(() => {
    const remaining = getLockRemaining();
    if (remaining > 0) {
      setLockRemaining(remaining);
    }
  }, []);

  useEffect(() => {
    if (lockRemaining <= 0) return;

    const interval = setInterval(() => {
      const remaining = getLockRemaining();
      if (remaining <= 0) {
        setLockRemaining(0);
        setError("");
      } else {
        setLockRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockRemaining]);

  const formatTime = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const handleComplete = useCallback(async (value: string) => {
    if (lockRemaining > 0) return;

    const valid = await verifyPin(value);
    if (valid) {
      resetAttempts();
      onUnlock();
    } else {
      const attempts = incrementAttempts();
      const remaining = MAX_ATTEMPTS - attempts;

      if (remaining <= 0) {
        const lockMs = getLockRemaining();
        setLockRemaining(lockMs);
        setError(`입력 횟수를 초과했습니다. ${formatTime(lockMs)} 후 다시 시도해주세요.`);
      } else {
        setError(`비밀번호가 틀렸습니다. (${remaining}회 남음)`);
      }
      setPin("");
    }
  }, [lockRemaining, onUnlock]);

  const isLocked = lockRemaining > 0;

  return (
    <div className={styles.screen}>
      <div className={styles.logoArea}>
        <div className={styles.logoBox}>
          <BarChart3 size={32} />
        </div>
      </div>

      {isLocked ? (
        <div className={styles.lockMessage}>
          <h2 className={styles.lockTitle}>일시 잠금</h2>
          <p className={styles.lockDesc}>
            비밀번호 입력 횟수를 초과했습니다.
          </p>
          <div className={styles.lockTimer}>
            {formatTime(lockRemaining)}
          </div>
          <p className={styles.lockHint}>후에 다시 시도해주세요.</p>
        </div>
      ) : (
        <PinKeypad
          pin={pin}
          maxLength={6}
          title="잠금 해제"
          subtitle="간편 비밀번호를 입력해주세요."
          error={error}
          onPinChange={(v) => {
            setError("");
            setPin(v);
          }}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
