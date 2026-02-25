"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AccessTime from "@mui/icons-material/AccessTime";
import Visibility from "@mui/icons-material/Visibility";
import Group from "@mui/icons-material/Group";
import LockOutlined from "@mui/icons-material/LockOutlined";
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
  const { status } = useSession();
  const router = useRouter();

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

  const handleMemberOnlyClick = (e: React.MouseEvent, postId: number) => {
    if (status !== "authenticated") {
      e.preventDefault();
      router.push(`/login?callbackUrl=${encodeURIComponent(detailHref(postId))}`);
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
        {items.map((post) => {
          const isMemberOnlyBlocked = post.is_member_only && status !== "authenticated";

          return (
            <Link
              key={post.id}
              href={detailHref(post.id)}
              className={styles.card}
              onClick={post.is_member_only ? (e) => handleMemberOnlyClick(e, post.id) : undefined}
            >
              <div className={styles.cardInner}>
                <div className={styles.content}>
                  {(post.category || post.tag || post.is_member_only) && (
                    <div className={styles.tags}>
                      {post.category && (
                        <span className={`${styles.category} ${styles.categoryDefault}`}>
                          {post.category}
                        </span>
                      )}
                      {post.tag && (
                        <span className={post.tag === 'NEW' ? styles.newBadge : styles.tag}>
                          {post.tag}
                        </span>
                      )}
                      {post.is_member_only && (
                        <span className={styles.memberOnly} title="회원전용">
                          <Group fontSize="inherit" />
                          회원전용
                        </span>
                      )}
                    </div>
                  )}
                  <h3 className={styles.title}>{post.title}</h3>
                  {isMemberOnlyBlocked ? (
                    <p className={styles.lockedSummary}>
                      <LockOutlined style={{ fontSize: "0.875rem", verticalAlign: "middle", marginRight: "0.25rem" }} />
                      로그인 후 열람할 수 있습니다
                    </p>
                  ) : (
                    <p className={styles.summary}>{post.summary}</p>
                  )}
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
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
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
