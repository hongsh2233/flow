"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import type { AdBannerItem } from "@/lib/types";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./AdBanner.module.css";

const gradientMap: Record<string, string> = {
  orange: styles.gradientOrange,
  blue: styles.gradientBlue,
  green: styles.gradientGreen,
  dark: styles.gradientDark,
};

export interface AdBannerProps {
  items: AdBannerItem[];
  autoSlide?: boolean;
  interval?: number;
}

export function AdBanner({ items, autoSlide = true, interval = 4000 }: AdBannerProps) {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const visibleItems = items.filter((_, i) => !dismissed.has(i));

  const goNext = useCallback(() => {
    if (visibleItems.length <= 1) return;
    setCurrent((prev) => (prev + 1) % visibleItems.length);
  }, [visibleItems.length]);

  useEffect(() => {
    if (!autoSlide || visibleItems.length <= 1) return;
    const timer = setInterval(goNext, interval);
    return () => clearInterval(timer);
  }, [autoSlide, interval, goNext, visibleItems.length]);

  const handleDismiss = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(index));
    if (current >= visibleItems.length - 1) {
      setCurrent(0);
    }
  };

  if (visibleItems.length === 0) return null;

  const item = visibleItems[current];

  const Wrapper = item.href ? "a" : "div";
  const wrapperProps = item.href
    ? { href: item.href, target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  const bannerClass = item.htmlContent
    ? `${styles.banner} ${styles.htmlBanner}`
    : item.imageUrl
      ? `${styles.banner} ${styles.imageBanner}`
      : `${styles.banner} ${styles.textBanner} ${gradientMap[item.gradient ?? "orange"] ?? styles.gradientOrange}`;

  return (
    <div className={styles.wrap}>
      <Wrapper className={bannerClass} {...wrapperProps}>
        {item.htmlContent ? (
          <div
            className={styles.htmlContent}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.htmlContent) }}
          />
        ) : item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title || "배너"} />
        ) : (
          <>
            <div className={styles.textLeft}>
              {item.label && <span className={styles.label}>{item.label}</span>}
              <p className={styles.title}>{item.title}</p>
              {item.description && <p className={styles.desc}>{item.description}</p>}
            </div>
            {item.emoji && <span className={styles.iconArea}>{item.emoji}</span>}
          </>
        )}
        {item.closeable && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={(e) => handleDismiss(e, items.indexOf(item))}
            aria-label="배너 닫기"
          >
            <X className={styles.closeIcon} aria-hidden />
          </button>
        )}
      </Wrapper>

      {visibleItems.length > 1 && (
        <div className={styles.indicator}>
          {visibleItems.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === current ? styles.dotActive : ""}`}
              onClick={() => setCurrent(i)}
              aria-label={`배너 ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
