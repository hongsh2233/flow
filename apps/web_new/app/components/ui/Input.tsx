"use client";

import styles from "./Input.module.css";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  withIcon?: boolean;
  className?: string;
}

export function Input({
  value,
  onChange,
  withIcon,
  className,
  ...props
}: InputProps) {
  return (
    <input
      value={value}
      onChange={onChange}
      className={`${styles.root} ${withIcon ? styles.rootWithIcon : ""} ${className ?? ""}`}
      {...props}
    />
  );
}
