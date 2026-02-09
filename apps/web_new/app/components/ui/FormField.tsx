"use client";

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
}: FormFieldProps) {
  const fieldId = id ?? label;
  return (
    <div className={styles.root}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        {Icon && <Icon className={styles.icon} aria-hidden />}
        <Input
          id={fieldId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          withIcon={!!Icon}
        />
      </div>
    </div>
  );
}
