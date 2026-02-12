"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AccessTime from "@mui/icons-material/AccessTime";
import Visibility from "@mui/icons-material/Visibility";
// import Comment from "@mui/icons-material/Comment"; // 댓글 기능 미구현 - 추후 추가 예정
import type { BoardListItem, BoardListProps } from "@/lib/types";
import { fetchBoardPosts, postToListItem } from "@/lib/services/boardService";
import styles from "./BoardList.module.css";

export function BoardList({
  boardId,
  items: externalItems,
  detailHref = (id) => `/report/${id}`,
  onLoadMore,
  emptyMessage = "게시글이 없습니다.",
}: BoardListProps) {
  const [items, setItems] = useState<BoardListItem[]>(externalItems || []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadPosts = useCallback(async (pageNum: number, append = false) => {
    if (!boardId) return;
    setLoading(true);
    try {
      const result = await fetchBoardPosts(boardId, pageNum, 10);
      if (result.success && result.data) {
        const converted = result.data.map(postToListItem);
        setItems(prev => append ? [...prev, ...converted] : converted);
        if (result.pagination) {
          setHasMore(pageNum < result.pagination.total_pages);
        } else {
          setHasMore(converted.length >= 10);
        }
      }
    } catch (error) {
      console.error("게시글 로딩 오류:", error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (externalItems) {
      setItems(externalItems);
      return;
    }
    if (boardId) {
      loadPosts(1);
    }
  }, [boardId, externalItems, loadPosts]);

  const handleLoadMore = () => {
    if (onLoadMore) {
      onLoadMore();
      return;
    }
    if (boardId && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage, true);
    }
  };

  if (!loading && items.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.listWrap}>
        {items.map((post) => (
          <Link
            key={post.id}
            href={detailHref(post.id)}
            className={styles.card}
          >
            <div className={styles.cardInner}>
              <div className={styles.content}>
                {/* 카테고리/태그 영역 - 카테고리 기능 미구현, 태그만 표시 */}
                {post.tag && (
                  <div className={styles.tags}>
                    {/* 카테고리 기능 미구현 - 추후 추가 예정
                    <span className={`${styles.category} ${styles.categoryDefault}`}>
                      {post.category}
                    </span>
                    */}
                    <span className={styles.tag}>{post.tag}</span>
                  </div>
                )}
                <h3 className={styles.title}>{post.title}</h3>
                <p className={styles.summary}>{post.summary}</p>
                <div className={styles.row}>
                  <div className={styles.left}>
                    <span>{post.author}</span>
                    <div className={styles.timeWrap}>
                      <span className={styles.timeIcon}>
                        <AccessTime fontSize="inherit" />
                      </span>
                      <span>{post.time}</span>
                    </div>
                  </div>
                  <div className={styles.right}>
                    <span className={styles.stat}>
                      <span className={styles.statIcon}>
                        <Visibility fontSize="inherit" />
                      </span>
                      {post.views.toLocaleString()}
                    </span>
                    {/* 댓글 기능 미구현 - 추후 추가 예정
                    <span className={styles.stat}>
                      <span className={styles.statIcon}>
                        <Comment fontSize="inherit" />
                      </span>
                      {post.comments}
                    </span>
                    */}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className={styles.moreWrap}>
          <button
            type="button"
            className={styles.moreBtn}
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? "불러오는 중..." : "더보기"}
          </button>
        </div>
      )}
    </>
  );
}

export default BoardList;
