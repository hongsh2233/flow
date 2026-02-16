"use client";

import { useState, useEffect, useCallback } from "react";
import { NewsList } from "./NewsList";
import styles from "./News.module.css";

const CATEGORIES = [
  { key: "economy", label: "경제", query: "경제" },
  { key: "finance", label: "금융", query: "금융" },
  { key: "stock", label: "주식", query: "주식" },
  // { key: "world", label: "세계", query: "세계" },
  // { key: "politics", label: "정치", query: "정치" },
  // { key: "society", label: "사회", query: "사회" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function AllNews() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("economy");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async (category: CategoryKey) => {
    try {
      setLoading(true);
      setError(null);
      const config = CATEGORIES.find((c) => c.key === category)!;
      const res = await fetch(
        `/api/naver-news?query=${encodeURIComponent(config.query)}&display=30&sort=date`
      );
      const data = await res.json();

      if (data.success && data.data) {
        setNews(data.data);
      } else {
        setError(data.message || "뉴스를 가져오는데 실패했습니다.");
      }
    } catch (err) {
      console.error("뉴스 조회 오류:", err);
      setError("뉴스를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(activeCategory);
  }, [activeCategory, fetchNews]);

  return (
    <div className={styles.allNews}>
      <div className={styles.categoryTabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`${styles.categoryTab} ${
              activeCategory === cat.key ? styles.categoryTabActive : ""
            }`}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className={styles.loading}>뉴스를 불러오는 중...</div>
      )}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && news.length === 0 && (
        <div className={styles.empty}>뉴스가 없습니다.</div>
      )}
      {!loading && !error && news.length > 0 && (
        <NewsList items={news} />
      )}
    </div>
  );
}

export interface NewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}
