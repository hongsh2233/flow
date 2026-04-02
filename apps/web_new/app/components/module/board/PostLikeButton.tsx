"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThumbUpAltOutlined from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbUpAlt from "@mui/icons-material/ThumbUpAlt";
import styles from "./BoardDetail.module.css";

type Props = {
  postId: number;
  initialCount: number;
  initialLiked: boolean;
};

export function PostLikeButton({ postId, initialCount, initialLiked }: Props) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);

  const onLike = async () => {
    if (liked || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      const data = (await res.json()) as {
        success?: boolean;
        like_count?: number;
        liked_by_me?: boolean;
        message?: string;
      };
      if (res.ok && data.success) {
        setLiked(Boolean(data.liked_by_me));
        if (typeof data.like_count === "number") {
          setCount(data.like_count);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(pathname || "/board")}`;

  return (
    <div className={styles.likeWrap}>
      <span className={styles.stat}>
        <span className={styles.statIcon}>
          {liked ? (
            <ThumbUpAlt fontSize="inherit" />
          ) : (
            <ThumbUpAltOutlined fontSize="inherit" />
          )}
        </span>
        {count.toLocaleString()}
      </span>
      {status === "loading" ? null : session ? (
        <button
          type="button"
          className={styles.likeBtn}
          disabled={liked || loading}
          onClick={onLike}
        >
          {liked ? "좋아요 함" : loading ? "…" : "좋아요"}
        </button>
      ) : (
        <Link href={loginUrl} className={styles.likeBtnLink}>
          로그인 후 좋아요
        </Link>
      )}
    </div>
  );
}
