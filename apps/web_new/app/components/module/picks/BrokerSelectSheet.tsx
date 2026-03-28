"use client";

import styles from "./Picks.module.css";

export type BrokerItem = {
  id: string;
  name: string;
  short?: string;
  logo_color?: string;
  mobile_web?: string;
  deep_link?: string;
  android_store?: string;
  /** App Store — iOS 앱 유도 시 (백엔드 BROKERS와 동일 키) */
  ios_store?: string;
  /** Play 패키지명 — Android intent:// 구성용 */
  android_package?: string;
};

type Props = {
  open: boolean;
  brokers: BrokerItem[];
  onClose: () => void;
  onSelect: (b: BrokerItem) => void;
};

export function BrokerSelectSheet({ open, brokers, onClose, onSelect }: Props) {
  if (!open) return null;

  return (
    <div
      className={styles.sheetOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="증권사 선택"
      onClick={onClose}
    >
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <span className={styles.sheetTitle}>증권사 선택</span>
          <button type="button" className={styles.btnSm} onClick={onClose}>
            닫기
          </button>
        </div>
        <div className={styles.brokerGrid}>
          {brokers.map((b) => (
            <button
              key={b.id}
              type="button"
              className={styles.brokerChip}
              onClick={() => {
                onSelect(b);
                onClose();
              }}
            >
              <span
                className={styles.brokerDot}
                style={{ background: b.logo_color || "#888" }}
                aria-hidden
              />
              <span>{b.short || b.name}</span>
            </button>
          ))}
        </div>
        <p className={styles.meta} style={{ marginTop: "0.75rem" }}>
          선택한 증권사 MTS·모바일웹으로 이동합니다.
        </p>
      </div>
    </div>
  );
}
