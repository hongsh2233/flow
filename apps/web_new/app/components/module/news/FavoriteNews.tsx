"use client";

import { useState, useEffect, useCallback } from "react";
import { NewsList } from "./NewsList";
import { getStockName } from "@/lib/data/stockCodeMap";
import type { NewsItem } from "./AllNews";
import styles from "./News.module.css";

interface FavoriteStock {
  code: string;
  name?: string;
}

export function FavoriteNews() {
  const [stocks, setStocks] = useState<FavoriteStock[]>([]);
  const [newsByStock, setNewsByStock] = useState<Record<string, NewsItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/favorites");
      const data = await res.json();
      if (data.success && Array.isArray(data.favorite_stocks)) {
        const codes = data.favorite_stocks as string[];
        setStocks(
          codes.map((code) => ({
            code,
            name: getStockName(code),
          }))
        );
      } else {
        setStocks([]);
      }
    } catch (err) {
      console.error("관심종목 조회 오류:", err);
      setError("관심종목을 불러오는데 실패했습니다.");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    if (stocks.length === 0) return;

    const fetchNewsForStocks = async () => {
      setLoading(true);
      setError(null);
      const results: Record<string, NewsItem[]> = {};

      await Promise.all(
        stocks.map(async (stock) => {
          const query = stock.name
            ? `${stock.name} 주가`
            : `${stock.code} 주가`;
          try {
            const res = await fetch(
              `/api/naver-news?query=${encodeURIComponent(query)}&display=10&sort=date`
            );
            const data = await res.json();
            if (data.success && data.data) {
              results[stock.code] = data.data;
            } else {
              results[stock.code] = [];
            }
          } catch {
            results[stock.code] = [];
          }
        })
      );

      setNewsByStock(results);
      setLoading(false);
    };

    fetchNewsForStocks();
  }, [stocks]);

  const allNews = Object.entries(newsByStock).flatMap(([code, items]) =>
    items.map((item) => ({ ...item, stockCode: code }))
  );
  const byDate = [...allNews].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  if (loading && stocks.length === 0) {
    return <div className={styles.loading}>관심종목 뉴스를 불러오는 중...</div>;
  }

  if (stocks.length === 0 && !loading) {
    return (
      <div className={styles.empty}>
        <p>등록된 관심종목이 없습니다.</p>
        <p className={styles.emptySub}>
          종목 페이지에서 관심종목을 등록한 후 뉴스를 확인하세요.
        </p>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (loading) {
    return <div className={styles.loading}>뉴스를 불러오는 중...</div>;
  }

  if (byDate.length === 0) {
    return (
      <div className={styles.empty}>
        관심종목 관련 뉴스가 없습니다.
      </div>
    );
  }

  return <NewsList items={byDate} />;
}
