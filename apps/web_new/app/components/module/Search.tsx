"use client";

import { Search as SearchIcon } from "lucide-react";
import type { SearchProps } from "@/lib/types";
import styles from "./Search.module.css";

export function Search({
    value,
    onChange,
    onSearch,
    placeholder = "종목명 또는 코드 검색",
    }: SearchProps) {
    const handleSearch = () => {
        onSearch?.(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
        }
    };

    return (
        <div className={styles.wrap}>
        <div className={styles.inner}>
            <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.input}
            aria-label={placeholder}
            />
            <button
            type="button"
            onClick={handleSearch}
            className={styles.searchBtn}
            aria-label="검색"
            >
            <SearchIcon className={styles.searchIcon} aria-hidden />
            </button>
        </div>
        </div>
    );
}
