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
  const [posts, setPosts] = useState<MainPostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/main-posts?limit=3")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          setPosts(result.data.slice(0, 3));
        }
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || posts.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <Sparkles className={styles.headingIcon} aria-hidden />
          이슈 체크
        </h3>
      </div>
      <div className={styles.cardList}>
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/board/${post.id}?from=${post.board_id}`}
            className={styles.card}
          >
            <h2 className={styles.title}>{post.title}</h2>
            {post.content && (
              <p className={styles.excerpt}>{post.content}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
