"use client";

import type { NewsItem } from "./AllNews";
import styles from "./News.module.css";

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getHostname(link: string): string {
  try {
    const url = link.startsWith("http") ? new URL(link) : new URL(`https://${link}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 뉴스 출처 표시명 정제 (ntt 등 내부 코드 숨김) */
function getDisplaySource(link: string): string {
  const hostname = getHostname(link);
  if (!hostname) return "뉴스";

  if (hostname === "ntt" || hostname.startsWith("ntt.")) {
    return "뉴스";
  }

  const friendlyNames: Record<string, string> = {
    "n.news.naver.com": "네이버 뉴스",
    "news.naver.com": "네이버 뉴스",
    "sports.news.naver.com": "네이버 스포츠",
    "m.sports.naver.com": "네이버 스포츠",
  };
  return friendlyNames[hostname] || hostname;
}

interface NewsListProps {
  items: (NewsItem & { stockCode?: string })[];
}

export function NewsList({ items }: NewsListProps) {
  return (
    <div className={styles.newsList}>
      {items.map((item, index) => (
        <a
          key={`${item.link}-${index}`}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.newsItem}
        >
          <h4 className={styles.newsTitle}>{item.title}</h4>
          {item.description && (
            <p className={styles.newsDesc}>{item.description}</p>
          )}
          <div className={styles.newsMeta}>
            <span className={styles.newsDate}>{formatDate(item.pubDate)}</span>
            <span className={styles.newsSource}>
              {getDisplaySource(item.originallink || item.link)}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
