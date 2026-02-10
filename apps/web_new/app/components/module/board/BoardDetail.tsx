"use client";

import Link from "next/link";
import Visibility from "@mui/icons-material/Visibility";
// import Comment from "@mui/icons-material/Comment"; // 댓글 기능 준비 중
import type { BoardDetailProps } from "@/lib/types";
import styles from "./BoardDetail.module.css";

export function BoardDetail({
  post,
  backHref = '/report',
  backLabel = '목록으로',
}: BoardDetailProps) {
  const isClosing = post.category === '마감시황'
  const categoryClass = isClosing ? styles.categoryClosing : styles.categoryDefault

  return (
    <article className={styles.wrap}>
      <div className={styles.backWrap}>
        <Link href={backHref} className={styles.backBtn}>
          ← {backLabel}
        </Link>
      </div>

      <header className={styles.header}>
        <div className={styles.tags}>
          <span className={`${styles.category} ${categoryClass}`}>
            {post.category}
          </span>
          {post.tag && <span className={styles.tag}>{post.tag}</span>}
        </div>
        <h1 className={styles.title}>{post.title}</h1>
        <div className={styles.meta}>
          <span className={styles.metaAuthor}>{post.author}</span>
          <span className={styles.metaSep}>·</span>
          <span>{post.time}</span>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.bodyContent}>{post.content}</div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statIcon}><Visibility fontSize="inherit" /></span>
            {post.views.toLocaleString()}
          </span>
          {/* 댓글 기능 준비 중
          <span className={styles.stat}>
            <span className={styles.statIcon}><Comment fontSize="inherit" /></span>
            {post.comments}
          </span>
          */}
        </div>
      </footer>
    </article>
  )
}

export default BoardDetail
