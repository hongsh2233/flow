"use client";

import { Search as SearchIcon } from "lucide-react";
import type { SearchProps } from "@/lib/types";
import styles from "./Search.module.css";

export function Search({
    value,
    onChange,
    placeholder = '종목명 또는 코드 검색',
    }: SearchProps) {
    return (
        <div className={styles.wrap}>
        <div className={styles.inner}>
            <SearchIcon className={styles.icon} aria-hidden />
            <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={styles.input}
            aria-label={placeholder}
            />
        </div>
        </div>
    )
}
