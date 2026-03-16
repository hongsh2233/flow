"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./MainCardNews.module.css";

interface MainPostItem {
  id: number;
  board_id: string;
  title: string;
  content: string;
  author?: string;
  views?: number;
  created_at?: string;
  updated_at?: string;
}

export function MainCardNews() {
  const [post, setPost] = useState<MainPostItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/main-posts?limit=1")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          setPost(result.data[0]);
        }
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !post) return null;

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <Sparkles className={styles.headingIcon} aria-hidden />
          이슈 체크
        </h3>
      </div>
      <Link
        href={`/board/${post.id}?from=${post.board_id}`}
        className={styles.card}
      >
        <h2 className={styles.title}>{post.title}</h2>
        {post.content && (
          <p className={styles.excerpt}>{post.content}</p>
        )}
      </Link>
    </section>
  );
}
