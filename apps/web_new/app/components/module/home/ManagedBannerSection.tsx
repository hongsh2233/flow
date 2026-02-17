"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AdBanner } from "../AdBanner";
import { SingleBanner } from "../SingleBanner";
import type { AdBannerItem, ManagedBannerItem } from "@/lib/types";

function managedToAdBannerItem(item: ManagedBannerItem): AdBannerItem {
  return {
    title: item.alt_text || "배너",
    imageUrl: item.image_url || undefined,
    htmlContent: item.html_content || undefined,
    href: item.link_url || undefined,
    closeable: false,
  };
}

/**
 * 배너관리(managed) 연동 섹션
 * - 단일(single): SingleBanner
 * - 슬라이드(slide): AdBanner
 */
export function ManagedBannerSection() {
  const pathname = usePathname();
  const [data, setData] = useState<{
    singles: ManagedBannerItem[];
    slides: { slide_group: string; items: ManagedBannerItem[] }[];
  } | null>(null);

  useEffect(() => {
    const pagePath = pathname || "/";

    const fetchBanners = async () => {
      try {
        const res = await fetch(
          `/api/banners/managed?page_path=${encodeURIComponent(pagePath)}`
        );
        const result = await res.json();

        if (result.success && result.data) {
          setData({
            singles: result.data.singles ?? [],
            slides: result.data.slides ?? [],
          });
        } else {
          setData({ singles: [], slides: [] });
        }
      } catch (err) {
        console.error("managed 배너 로딩 실패:", err);
        setData({ singles: [], slides: [] });
      }
    };

    fetchBanners();
  }, [pathname]);

  if (!data) return null;

  const hasSingles = data.singles.length > 0;
  const hasSlides = data.slides.length > 0;

  if (!hasSingles && !hasSlides) return null;

  return (
    <>
      {data.singles.map((item) => (
        <SingleBanner key={item.id} item={item} />
      ))}
      {data.slides.map(({ slide_group, items }) => {
        const adItems: AdBannerItem[] = items
          .sort((a, b) => a.order_index - b.order_index)
          .map(managedToAdBannerItem);
        if (adItems.length === 0) return null;
        return (
          <AdBanner
            key={slide_group}
            items={adItems}
            autoSlide
            interval={5000}
          />
        );
      })}
    </>
  );
}
