"use client";

import styles from "./Button.module.css";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  large?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  fullWidth,
  large,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.root} ${styles[variant]} ${fullWidth ? styles.fullWidth : ""} ${large ? styles.large : ""} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
