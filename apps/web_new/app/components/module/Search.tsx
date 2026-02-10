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
          className={styles.searchBtn}
          onClick={handleSearch}
          aria-label="검색"
        >
          <SearchIcon className={styles.icon} aria-hidden />
        </button>
      </div>
    </div>
  );
}
