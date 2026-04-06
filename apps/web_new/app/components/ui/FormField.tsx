"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";
import type { FormFieldProps } from "@/lib/types";
import styles from "./FormField.module.css";

export function FormField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  icon: Icon,
  id,
  readOnly,
  showPasswordToggle,
  maxLength,
}: FormFieldProps) {
  const fieldId = id ?? label;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const useToggle = Boolean(showPasswordToggle && isPassword && !readOnly);
  const inputType = useToggle && passwordVisible ? "text" : type;

  return (
    <div className={styles.root}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        {Icon && <Icon className={styles.icon} aria-hidden />}
        <Input
          id={fieldId}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          withIcon={!!Icon}
          withPasswordToggle={useToggle}
          readOnly={readOnly}
          maxLength={maxLength}
          className={readOnly ? styles.readOnly : ""}
        />
        {useToggle && (
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setPasswordVisible((v) => !v)}
            aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 표시"}
            aria-pressed={passwordVisible}
            tabIndex={0}
          >
            {passwordVisible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}
