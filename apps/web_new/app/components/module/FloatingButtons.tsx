"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BottomSheet } from "@/app/components/ui/BottomSheet/BottomSheet";
import styles from "./FloatingButtons.module.css";

type StockTerm = {
  id: number;
  term: string;
  description: string;
  category: string | null;
};

const POPULAR_TERMS = [
  "시가총액", "PER", "PBR", "배당금", "공매도",
  "상한가", "거래량", "ETF",
];

const CATEGORIES = ["전체", "기본개념", "매매/거래", "차트/기술분석", "재무/펀더멘털", "파생상품", "기타"];

export default function FloatingButtons() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className={styles.wrap}>
        <button
          className={`${styles.fab} ${styles.scrollTop} ${showScrollTop ? styles.scrollTopVisible : ""}`}
          onClick={scrollToTop}
          aria-label="맨 위로"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>

        <div style={{ position: "relative" }}>
          <span className={styles.dictLabel}>주식용어</span>
          <button
            className={`${styles.fab} ${styles.dictBtn}`}
            onClick={() => setSheetOpen(true)}
            aria-label="주식용어사전"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="9" y1="7" x2="16" y2="7" />
              <line x1="9" y1="11" x2="14" y2="11" />
            </svg>
          </button>
        </div>
      </div>

      {sheetOpen && (
        <StockTermSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      )}
    </>
  );
}

function StockTermSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [terms, setTerms] = useState<StockTerm[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchTerms = useCallback(async (q: string, cat: string, p: number, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (cat && cat !== "전체") params.set("category", cat);
      params.set("page", String(p));
      params.set("per_page", "20");

      const res = await fetch(`/api/stock-terms?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const items: StockTerm[] = data.items ?? [];

      if (append) {
        setTerms((prev) => [...prev, ...items]);
      } else {
        setTerms(items);
      }
      setTotal(data.total ?? 0);
    } catch {
      if (!append) setTerms([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms("", "전체", 1);
  }, [fetchTerms]);

  useEffect(() => {
    if (initialLoad) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchTerms(query, category, 1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, category]);

  const handleChipClick = (term: string) => {
    setQuery(term);
    setCategory("전체");
    inputRef.current?.focus();
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTerms(query, category, nextPage, true);
  };

  const hasMore = terms.length < total;
  const showPopular = !query.trim() && category === "전체";

  return (
    <BottomSheet open={open} onClose={onClose} title="주식용어사전">
      {/* 검색 */}
      <div className={styles.searchWrap}>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="용어를 검색하세요"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query ? (
          <button className={styles.clearBtn} onClick={() => setQuery("")} aria-label="지우기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : (
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </div>

      {/* 인기 검색어 */}
      {showPopular && (
        <div className={styles.popularSection}>
          <p className={styles.sectionTitle}>인기 검색어</p>
          <div className={styles.chipWrap}>
            {POPULAR_TERMS.map((t) => (
              <button key={t} className={styles.chip} onClick={() => handleChipClick(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 카테고리 필터 */}
      <div className={styles.categoryWrap}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`${styles.categoryBtn} ${category === c ? styles.categoryBtnActive : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 결과 */}
      {!initialLoad && total > 0 && (
        <p className={styles.totalCount}>총 {total}개의 용어</p>
      )}

      {initialLoad || (loading && terms.length === 0) ? (
        <div className={styles.loading}>검색 중...</div>
      ) : terms.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📖</div>
          <p className={styles.emptyText}>
            {query ? `"${query}"에 대한 결과가 없습니다` : "등록된 용어가 없습니다"}
          </p>
        </div>
      ) : (
        <div className={styles.resultList}>
          {terms.map((t) => (
            <div key={t.id} className={styles.resultItem}>
              <p className={styles.termName}>
                {t.term}
                {t.category && <span className={styles.termCategory}>{t.category}</span>}
              </p>
              <p className={styles.termDesc}>{t.description}</p>
            </div>
          ))}
          {hasMore && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loading}>
                {loading ? "불러오는 중..." : "더보기"}
              </button>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
