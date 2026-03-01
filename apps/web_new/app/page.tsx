"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { StockTermBox } from "./components/module/stock-term-box";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import type { StockDetail, AdBannerItem, ManagedBannerItem } from "@/lib/types";
import { AdBanner } from "./components/module/AdBanner";
import { FavoriteStocks } from "./components/module/home/FavoriteStocks";
import { MarketIndexSection } from "./components/module/home/MarketIndexSection";
import { ForeignIndices } from "./components/module/home/ForeignIndices";
import { ExchangeRatesSection } from "./components/module/home/ExchangeRatesSection";
import { RealtimeSearchSection } from "./components/module/home/RealtimeSearchSection";
import { JubtiSection } from "./components/module/home/JubtiSection";
const LazyStockDetailModal = dynamic(
  () => import("./components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);
const LazyPopupModal = dynamic(
  () => import("./components/module/PopupModal").then((m) => ({ default: m.PopupModal })),
  { ssr: false }
);

function managedToAdBannerItem(item: ManagedBannerItem): AdBannerItem {
  return {
    title: item.alt_text || "배너",
    imageUrl: item.image_url || undefined,
    htmlContent: item.html_content || undefined,
    href: item.link_url || undefined,
    closeable: false,
  };
}

function byOrder(a: ManagedBannerItem, b: ManagedBannerItem) {
  return a.order_index - b.order_index;
}

export default function Home() {
  const { status } = useSession();
  const { favoriteStocks, isLoading: isLoadingFavorites } = useFavoriteStocks();
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const [bannerTop, setBannerTop] = useState<AdBannerItem[]>([]);
  const [bannerBottom, setBannerBottom] = useState<AdBannerItem[]>([]);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  useEffect(() => {
    fetch(`/api/banners/managed?page_path=${encodeURIComponent("/")}`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success || !result.data) return;
        const singles = (result.data.singles ?? []) as ManagedBannerItem[];
        const slides = (result.data.slides ?? []) as { items: ManagedBannerItem[] }[];
        const topSingles = singles.filter((s) => (s.display_position ?? "bottom") === "top").sort(byOrder);
        const bottomSingles = singles.filter((s) => (s.display_position ?? "bottom") === "bottom").sort(byOrder);
        const topSlideItems = slides
          .filter((s) => s.items?.length && ((s.items[0] as ManagedBannerItem).display_position ?? "bottom") === "top")
          .flatMap((s) => s.items ?? [])
          .sort(byOrder);
        const bottomSlideItems = slides
          .filter((s) => s.items?.length && ((s.items[0] as ManagedBannerItem).display_position ?? "bottom") !== "top")
          .flatMap((s) => s.items ?? [])
          .sort(byOrder);
        setBannerTop([...topSingles, ...topSlideItems].map(managedToAdBannerItem));
        setBannerBottom([...bottomSingles, ...bottomSlideItems].map(managedToAdBannerItem));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="content__wrap">
      <StockTermBox wrapperClassName="home-term-wrap" />
      {bannerTop.length > 0 && (
        <section style={{ margin: "0 0 1rem 0" }}>
          <AdBanner items={bannerTop} autoSlide interval={5000} />
        </section>
      )}
      <ForeignIndices />
      <ExchangeRatesSection />
      <MarketIndexSection />

      {status === "loading" ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          로그인 정보 확인 중...
        </div>
      ) : status === "authenticated" ? (
        isLoadingFavorites ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
            관심종목 불러오는 중...
          </div>
        ) : (
          <FavoriteStocks stocks={favoriteStocks} onSelect={setSelectedStock} />
        )
      ) : (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          <p>관심종목은 로그인 후 이용할 수 있습니다.</p>
          <a href="/login" style={{ color: "var(--app-accent)", marginTop: "0.5rem", display: "inline-block" }}>
            로그인하기
          </a>
        </div>
      )}

      <RealtimeSearchSection />
      <JubtiSection />
      {bannerBottom.length > 0 && (
        <section style={{ margin: "1rem 0" }}>
          <AdBanner items={bannerBottom} autoSlide interval={5000} />
        </section>
      )}

      {selectedStock && <LazyStockDetailModal stock={selectedStock} onClose={handleClose} />}
      <LazyPopupModal />
    </div>
  );
}
