"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { StockTermBox } from "./components/module/stock-term-box";
import { useFavoriteStocks } from "@/lib/hooks/useFavoriteStocks";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import { addFavoriteStock, removeFavoriteStock } from "@/lib/services/authService";
import type { StockDetail, AdBannerItem, ManagedBannerItem } from "@/lib/types";
import { AdBanner } from "./components/module/AdBanner";
import { AdZoneSlot } from "./components/module/AdZoneSlot";
import { shouldShowAdZoneB_regular } from "@/lib/affiliate/adZoneB";
import { FavoriteStocks } from "./components/module/home/FavoriteStocks";
import { InvestorTrendChart } from "./components/module/home/InvestorTrendChart";
import { MainCardNews } from "./components/module/home/MainCardNews";
import { SupplySummaryCard } from "./components/module/home/SupplySummaryCard";
import { HomeMarketCta } from "./components/module/home/HomeMarketCta";
import { SentimentIndexCard } from "./components/module/home/SentimentIndexCard";
import { RandomAffiliateCard } from "./components/module/affiliate/RandomAffiliateCard";
import { RealtimeSearchSection } from "./components/module/home/RealtimeSearchSection";
import { JubtiSection } from "./components/module/home/JubtiSection";
import { MarketTabSection } from "./components/module/home/MarketTabSection";
const LazyStockDetailModal = dynamic(
  () => import("./components/module/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
  { ssr: false }
);
const LazyPopupModal = dynamic(
  () => import("./components/module/PopupModal").then((m) => ({ default: m.PopupModal })),
  { ssr: false }
);
const LazyMarketSummaryPopup = dynamic(
  () => import("./components/module/MarketSummaryPopup").then((m) => ({ default: m.MarketSummaryPopup })),
  { ssr: false }
);
const LazySchedulePopup = dynamic(
  () => import("./components/module/SchedulePopup").then((m) => ({ default: m.SchedulePopup })),
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
  const { data: session, status } = useSession();
  const { favoriteStocks, favCodes, isLoading: isLoadingFavorites } = useFavoriteStocks();
  const { addFavCode, removeFavCode } = useFavoriteStore();
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const [bannerBottom, setBannerBottom] = useState<AdBannerItem[]>([]);
  const handleClose = useCallback(() => setSelectedStock(null), []);

  const refreshFavorites = useCallback(() => {
    window.dispatchEvent(new Event("favoritesUpdated"));
  }, []);

  const handleAddFavorite = useCallback(
    async (stock: StockDetail) => {
      if (!session?.user?.email) return;
      addFavCode(stock.code);
      const res = await addFavoriteStock({ email: session.user.email, stock_code: stock.code });
      if (res.success) {
        refreshFavorites();
      } else {
        removeFavCode(stock.code);
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );

  const handleRemoveFavorite = useCallback(
    async (stock: StockDetail) => {
      if (!session?.user?.email) return;
      removeFavCode(stock.code);
      const res = await removeFavoriteStock({ email: session.user.email, stock_code: stock.code });
      if (res.success) {
        refreshFavorites();
      } else {
        addFavCode(stock.code);
      }
    },
    [session?.user?.email, addFavCode, removeFavCode, refreshFavorites]
  );

  /* 메인 페이지 하단 배너 (상단은 LayoutShell의 ManagedBannerSection이 처리) */
  useEffect(() => {
    fetch(`/api/banners/managed?page_path=${encodeURIComponent("/")}&position=bottom`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success || !result.data) return;
        const singles = (result.data.singles ?? []) as ManagedBannerItem[];
        const slides = (result.data.slides ?? []) as { items: ManagedBannerItem[] }[];
        const items = [
          ...singles.sort(byOrder),
          ...slides.flatMap((s) => s.items ?? []).sort(byOrder),
        ].map(managedToAdBannerItem);
        setBannerBottom(items);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="content__wrap">
      <SupplySummaryCard />
      {/*
        홈→마켓: AI 추천 CTA. BO 배너만 쓰려면 제거하고 ManagedBannerSection에
        page_path=/, link_url=/market 로 등록 가능.
      */}
      <SentimentIndexCard />
      <HomeMarketCta />
      <MainCardNews />
      {/* [AD_ZONE B1 — 이슈체크·주요지수 사이 / 일반회원까지] */}
      {shouldShowAdZoneB_regular(session, status) && <AdZoneSlot zone="B1" />}
      <MarketTabSection />
      <InvestorTrendChart defaultMarket="kospi" variant="main" hideMoreLink />

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

      {/* [AD_ZONE B2 — 관심종목 아래 / 일반회원까지] */}
      {shouldShowAdZoneB_regular(session, status) && <AdZoneSlot zone="B2" />}
      {status === "loading" ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          로그인 정보 확인 중...
        </div>
      ) : status === "authenticated" ? (
        <RealtimeSearchSection />
      ) : (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          <p>실시간 검색상위는 로그인 후 이용할 수 있습니다.</p>
          <a href="/login" style={{ color: "var(--app-accent)", marginTop: "0.5rem", display: "inline-block" }}>
            로그인하기
          </a>
        </div>
      )}
      <JubtiSection />
      <StockTermBox wrapperClassName="home-term-wrap" />
      {bannerBottom.length > 0 && (
        <section style={{ margin: "1rem 0" }}>
          <AdBanner items={bannerBottom} autoSlide interval={5000} />
        </section>
      )}

      <section style={{ margin: "1rem 0 1.5rem" }} aria-label="제휴 상품">
        <RandomAffiliateCard />
      </section>

      {selectedStock && (
        <LazyStockDetailModal
          stock={selectedStock}
          onClose={handleClose}
          isFavorited={favCodes.has(selectedStock.code)}
          onAddFavorite={handleAddFavorite}
          onRemoveFavorite={handleRemoveFavorite}
        />
      )}
      <LazyPopupModal />
      <Suspense fallback={null}>
        <LazyMarketSummaryPopup />
      </Suspense>
      <LazySchedulePopup />
    </div>
  );
}
