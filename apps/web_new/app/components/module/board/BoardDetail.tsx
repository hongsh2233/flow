"use client";

import Link from "next/link";
import Visibility from "@mui/icons-material/Visibility";
import Group from "@mui/icons-material/Group";
// import Comment from "@mui/icons-material/Comment"; // 댓글 기능 미구현 - 추후 추가 예정
import type { BoardDetailProps } from "@/lib/types";
import { getImageUrl } from "@/lib/config/api";
import styles from "./BoardDetail.module.css";

export function BoardDetail({
  post,
  backHref = '/report',
  backLabel = '목록으로',
}: BoardDetailProps) {
  const hasHtml = post.content.includes('<') && post.content.includes('>');

  return (
    <article className={styles.wrap}>
      <div className={styles.backWrap}>
        <Link href={backHref} className={styles.backBtn}>
          ← {backLabel}
        </Link>
      </div>

      <header className={styles.header}>
        {/* 카테고리/태그 영역 */}
        {(post.tag || post.is_member_only) && (
          <div className={styles.tags}>
            {post.tag && <span className={styles.tag}>{post.tag}</span>}
            {post.is_member_only && (
              <span className={styles.memberOnly} title="회원전용">
                <Group fontSize="inherit" />
                회원전용
              </span>
            )}
          </div>
        )}
        <h1 className={styles.title}>{post.title}</h1>
        <div className={styles.meta}>
          <span className={styles.metaAuthor}>{post.author}</span>
          <span className={styles.metaSep}>·</span>
          <span>{post.time}</span>
        </div>
      </header>

      <div className={styles.body}>
        {hasHtml ? (
          <div
            className={styles.bodyContent}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <div className={styles.bodyContent}>{post.content}</div>
        )}
      </div>

      {/* 첨부파일 */}
      {post.attachments && post.attachments.length > 0 && (
        <div className={styles.attachments}>
          <h4 className={styles.attachmentsTitle}>첨부파일</h4>
          <ul className={styles.attachmentsList}>
            {post.attachments.map((file, idx) => (
              <li key={idx} className={styles.attachmentItem}>
                <a
                  href={getImageUrl(file.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.attachmentLink}
                >
                  {file.filename}
                  {file.formatted_size && (
                    <span className={styles.attachmentSize}>({file.formatted_size})</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className={styles.footer}>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statIcon}><Visibility fontSize="inherit" /></span>
            {post.views.toLocaleString()}
          </span>
          {/* 댓글 기능 미구현 - 추후 추가 예정
          <span className={styles.stat}>
            <span className={styles.statIcon}><Comment fontSize="inherit" /></span>
            {post.comments}
          </span>
          */}
        </div>
      </footer>

      {/* 댓글 영역 - 추후 추가 예정
      <section className={styles.commentsSection}>
        <h3>댓글</h3>
        <div className={styles.commentInput}>
          <textarea placeholder="댓글을 입력하세요..." />
          <button>등록</button>
        </div>
        <div className={styles.commentList}>
          댓글 목록이 여기에 표시됩니다.
        </div>
      </section>
      */}
    </article>
  );
}

export default BoardDetail;
