"use client";

import { useState, useEffect } from "react";
import { AdBanner } from "../AdBanner";
import type { AdBannerItem } from "@/lib/types";

/**
 * 배너 - BO /api/banners 경유
 */
export function BannerSection({ type = "banner" }: { type?: "banner" }) {
  const [items, setItems] = useState<AdBannerItem[]>([]);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetch(`/api/banners?banner_type=${type}`);
        const result = await response.json();

        if (result.success && result.data?.length > 0) {
          setItems(result.data);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error("배너 로딩 실패:", err);
        setItems([]);
      }
    };

    fetchBanners();
  }, [type]);

  if (items.length === 0) return null;

  return <AdBanner items={items} autoSlide interval={5000} />;
}
