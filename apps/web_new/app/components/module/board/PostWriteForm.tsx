"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/hooks/useTheme";
import type { Editor as EditorType } from "@toast-ui/react-editor";
import styles from "./PostWriteForm.module.css";

// TOAST UI Editor는 SSR 미지원 → 클라이언트 전용 동적 임포트
const Editor = dynamic(
  () => import("@toast-ui/react-editor").then((m) => m.Editor),
  { ssr: false }
);

interface PostWriteFormProps {
  boardId: string;
}

export function PostWriteForm({ boardId }: PostWriteFormProps) {
  const editorRef = useRef<EditorType>(null);
  const { isDark } = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editorReady, setEditorReady] = useState(false);

  // TOAST UI Editor CSS 동적 로드 (SSR에서 오류 방지)
  useEffect(() => {
    Promise.all([
      import("@toast-ui/editor/dist/toastui-editor.css" as string),
      import("@toast-ui/editor/dist/theme/toastui-editor-dark.css" as string),
    ]).finally(() => setEditorReady(true));
  }, []);

  // 이미지 업로드 훅: blob → /api/upload-image → URL 반환
  const addImageBlobHook = async (
    blob: File | Blob,
    callback: (url: string, alt: string) => void
  ) => {
    const formData = new FormData();
    formData.append("file", blob);

    try {
      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        callback(data.url, "이미지");
      } else {
        alert("이미지 업로드에 실패했습니다.");
      }
    } catch {
      alert("이미지 업로드 중 오류가 발생했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }

    const editorInstance = editorRef.current?.getInstance();
    if (!editorInstance) return;

    const content = editorInstance.getHTML();
    const stripped = content.replace(/<[^>]+>/g, "").trim();
    if (!stripped) {
      setError("내용을 입력해 주세요.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/boards/${boardId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
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

  return (
    <div className={styles.wrap}>
      <h2 className={styles.pageTitle}>게시글 작성</h2>

      <input
        className={styles.titleInput}
        type="text"
        placeholder="제목을 입력하세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />

      <div className={styles.editorWrap}>
        {editorReady && (
          <Editor
            ref={editorRef}
            initialValue=""
            previewStyle="vertical"
            height="500px"
            initialEditType="wysiwyg"
            useCommandShortcut={true}
            theme={isDark ? "dark" : "light"}
            hooks={{ addImageBlobHook }}
            toolbarItems={[
              ["heading", "bold", "italic", "strike"],
              ["hr", "quote"],
              ["ul", "ol", "task", "indent", "outdent"],
              ["table", "image", "link"],
              ["code", "codeblock"],
            ]}
          />
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => router.back()}
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
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}

export default PostWriteForm;
