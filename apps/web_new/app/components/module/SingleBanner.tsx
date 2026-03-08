"use client";

import type { ManagedBannerItem } from "@/lib/types";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import styles from "./SingleBanner.module.css";

export interface SingleBannerProps {
  item: ManagedBannerItem;
}

/**
 * 단일 배너 컴포넌트 (배너관리 1개형)
 * 이미지 또는 HTML 콘텐츠, 링크 지원
 */
export function SingleBanner({ item }: SingleBannerProps) {
  const Wrapper = item.link_url ? "a" : "div";
  const wrapperProps = item.link_url
    ? {
        href: item.link_url,
        target: "_blank" as const,
        rel: "noopener noreferrer",
      }
    : {};

  const content =
    item.content_type === "html" && item.html_content ? (
      <div
        className={styles.htmlContent}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.html_content) }}
      />
    ) : item.image_url ? (
      <img src={item.image_url} alt={item.alt_text || "배너"} />
    ) : null;

  if (!content) return null;

  return (
    <div className={styles.singleBanner}>
      <Wrapper className={styles.inner} {...wrapperProps}>
        {content}
      </Wrapper>
    </div>
  );
}
