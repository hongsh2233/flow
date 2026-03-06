"use client";

import { useState, useEffect, useCallback } from "react";
import { NewsList } from "../news/NewsList";
import type { NewsItem } from "../news/AllNews";
import styles from "../news/News.module.css";

const CATEGORIES = [
  { key: "", label: "전체" },
  { key: "수주", label: "수주" },
  { key: "실적발표", label: "실적발표" },
  { key: "배당", label: "배당" },
  { key: "연구개발", label: "연구개발" },
  { key: "기술이전", label: "기술이전" },
  { key: "유상증자", label: "유상증자" },
  { key: "무상증자", label: "무상증자" },
  { key: "자사주매입", label: "자사주매입" },
  { key: "합병인수", label: "합병인수" },
  { key: "특허", label: "특허" },
  { key: "임상", label: "임상" },
  { key: "적자전환", label: "적자전환" },
  { key: "상장", label: "상장" },
  { key: "분할", label: "분할" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface StockNewsItem {
  id: number;
  category: string;
  keyword: string;
  title: string;
  description: string | null;
  link: string;
  pub_date: string | null;
  pub_datetime: string | null;
  collected_at: string | null;
}

function toNewsItem(item: StockNewsItem): NewsItem & { stockName?: string } {
  return {
    title: item.title,
    originallink: item.link,
    link: item.link,
    description: item.description ?? "",
    pubDate: item.pub_datetime ?? item.pub_date ?? item.collected_at ?? "",
    stockName: item.category,
  };
}

export function SpotlightNews() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("");
  const [news, setNews] = useState<(NewsItem & { stockName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async (category: CategoryKey) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "50" });
      if (category) params.set("category", category);
      const res = await fetch(`/api/naver-stock-news?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setNews((data.data as StockNewsItem[]).map(toNewsItem));
      } else {
        setError(data.message || "뉴스를 가져오는데 실패했습니다.");
      }
    } catch {
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

      {loading && <div className={styles.loading}>뉴스를 불러오는 중...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && news.length === 0 && (
        <div className={styles.empty}>주목 뉴스가 없습니다.</div>
      )}
      {!loading && !error && news.length > 0 && <NewsList items={news} />}
    </div>
  );
}
