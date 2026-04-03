"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./PostWriteForm.module.css";

interface PostWriteFormProps {
  boardId: string;
}

export function PostWriteForm({ boardId }: PostWriteFormProps) {
  const { status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [useAiSummary, setUseAiSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = encodeURIComponent(`/board/write?board=${boardId}`);
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [status, boardId, router]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!content.trim()) {
      setError("내용을 입력해 주세요.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/boards/${boardId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          reference_text: referenceText.trim() || undefined,
          use_ai_summary: useAiSummary,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "게시글 작성에 실패했습니다.");
        return;
      }

      router.push(`/board?board=${boardId}`);
      router.refresh();
    } catch {
      setError("서버 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.backWrap}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push(`/board?board=${boardId}`)}
        >
          ← 목록으로
        </button>
      </div>

      <h2 className={styles.pageTitle}>게시글 작성</h2>

      <input
        className={styles.titleInput}
        type="text"
        placeholder="제목을 입력하세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />

      <textarea
        className={styles.contentTextarea}
        placeholder="내용을 입력하세요..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={20}
      />

      <textarea
        className={styles.contentTextarea}
        placeholder="참고 문구 (선택사항) - 입력하면 원문 그대로 등록됩니다."
        value={referenceText}
        onChange={(e) => setReferenceText(e.target.value)}
        rows={4}
        style={{ marginTop: "0.5rem" }}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          margin: "0.75rem 0",
          fontSize: "0.9rem",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={useAiSummary}
          onChange={(e) => setUseAiSummary(e.target.checked)}
        />
        <span>AI 요약 후 등록 (참고 문구가 없을 때 Gemini가 내용을 요약합니다)</span>
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => router.push(`/board?board=${boardId}`)}
          disabled={submitting}
        >
          취소
        </button>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? useAiSummary && !referenceText.trim()
              ? "AI 요약 중..."
              : "등록 중..."
            : "등록"}
        </button>
      </div>
    </div>
  );
}

export default PostWriteForm;
