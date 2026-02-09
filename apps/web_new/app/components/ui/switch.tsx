"use client";

import * as React from "react";

import styles from "./Switch.module.css";

type SwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

function Switch({
  checked,
  defaultChecked,
  onChange,
  disabled,
  className,
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState<boolean>(
    defaultChecked ?? false
  );

  const isControlled = checked !== undefined;
  const isChecked = isControlled ? checked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;
    const next = !isChecked;

    if (!isControlled) {
      setInternalChecked(next);
    }

    onChange?.(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-disabled={disabled}
      disabled={disabled}
      className={`${styles.root} ${
        isChecked ? styles.rootChecked : ""
      } ${disabled ? styles.rootDisabled : ""} ${className ?? ""}`}
      onClick={handleToggle}
    >
      <span
        className={`${styles.thumb} ${
          isChecked ? styles.thumbChecked : ""
        }`}
      />
    </button>
  );
}

export { Switch };
