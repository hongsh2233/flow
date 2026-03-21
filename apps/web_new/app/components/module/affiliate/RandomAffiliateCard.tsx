"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { shouldShowAdZoneA } from "@/lib/affiliate/adZoneA";
import styles from "./RandomAffiliateCard.module.css";

export interface AffiliateProductRow {
  id: number;
  title: string | null;
  image_url: string | null;
  sale_price: string | null;
  original_price: string | null;
  discount_percent: string | null;
  affiliate_url: string | null;
  external_product_id: string;
}

interface RandomAffiliateCardProps {
  /** 용어 바텀시트 등 좁은 영역 */
  compact?: boolean;
  className?: string;
}

export function RandomAffiliateCard({ compact, className }: RandomAffiliateCardProps) {
  const { data: session, status } = useSession();
  const [item, setItem] = useState<AffiliateProductRow | null>(null);

  const eligible = shouldShowAdZoneA(session, status);

  useEffect(() => {
    if (!eligible) {
      setItem(null);
      return;
    }
    let cancelled = false;
    fetch("/api/affiliate-products", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { success?: boolean; data?: AffiliateProductRow[] }) => {
        if (cancelled || !body?.success || !Array.isArray(body.data) || body.data.length === 0) {
          return;
        }
        const list = body.data.filter((p) => p.affiliate_url);
        if (list.length === 0) return;
        const pick = list[Math.floor(Math.random() * list.length)];
        if (!cancelled) setItem(pick);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  if (!eligible || !item?.affiliate_url) return null;

  const title =
    (item.title && item.title.trim()) ||
    `상품 ${item.external_product_id.slice(0, 12)}${item.external_product_id.length > 12 ? "…" : ""}`;

  return (
    <aside
      className={`${styles.wrap} ${compact ? styles.compact : ""} ${className ?? ""}`.trim()}
      aria-label="A구역 제휴 추천"
      data-ad-zone="A"
    >
      <p className={styles.badge}>A구역 · 제휴</p>
      <a
        href={item.affiliate_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={styles.card}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className={styles.thumb}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={styles.thumb} aria-hidden />
        )}
        <div className={styles.body}>
          <p className={styles.title}>{title}</p>
          <div className={styles.priceRow}>
            {item.sale_price ? <span className={styles.sale}>{item.sale_price}</span> : null}
            {item.original_price ? <span className={styles.original}>{item.original_price}</span> : null}
            {item.discount_percent ? <span className={styles.discount}>{item.discount_percent}</span> : null}
          </div>
          <span className={styles.cta}>알리에서 보기 →</span>
        </div>
      </a>
    </aside>
  );
}
