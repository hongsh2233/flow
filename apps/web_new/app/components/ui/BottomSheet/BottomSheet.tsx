"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./BottomSheet.module.css";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  halfHeight?: boolean;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, halfHeight, children }: BottomSheetProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={halfHeight ? styles.sheetHalf : styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "bottomsheet-title" : undefined}
      >
        <div className={styles.handle} aria-hidden />
        {title && (
          <h3 id="bottomsheet-title" className={styles.title}>
            {title}
          </h3>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
