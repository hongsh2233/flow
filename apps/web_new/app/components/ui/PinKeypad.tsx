"use client";

import { useMemo } from "react";
import { Delete } from "lucide-react";
import styles from "./PinKeypad.module.css";

interface PinKeypadProps {
  pin: string;
  maxLength?: number;
  title: string;
  subtitle?: string;
  error?: string;
  onPinChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
}

/** Fisher–Yates 셔플 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PinKeypad({
  pin,
  maxLength = 6,
  title,
  subtitle,
  error,
  onPinChange,
  onComplete,
}: PinKeypadProps) {
  // 마운트 시 숫자 배치를 랜덤으로 결정
  const keys = useMemo(() => {
    const digits = shuffle(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    // 3x4 그리드: 9개 숫자 + 빈칸 + 마지막 숫자 + 삭제
    const grid = [...digits.slice(0, 9), "", digits[9], "del"];
    return grid;
  }, []);

  const handlePress = (digit: string) => {
    if (pin.length >= maxLength) return;
    const next = pin + digit;
    onPinChange(next);
    if (next.length === maxLength) {
      onComplete?.(next);
    }
  };

  const handleDelete = () => {
    onPinChange(pin.slice(0, -1));
  };

  return (
    <div className={styles.container}>
      <div className={styles.display}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <div className={styles.dots}>
          {Array.from({ length: maxLength }, (_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i < pin.length ? styles.dotFilled : ""} ${
                error ? styles.dotError : ""
              }`}
            />
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.keypad}>
        {keys.map((key, i) => {
          if (key === "") {
            return <div key={i} className={styles.keyEmpty} />;
          }
          if (key === "del") {
            return (
              <button
                key={i}
                type="button"
                className={styles.key}
                onClick={handleDelete}
                aria-label="삭제"
              >
                <Delete size={22} />
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              className={styles.key}
              onClick={() => handlePress(key)}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
