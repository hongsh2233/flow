"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useThemeContext } from "@/app/components/providers/ThemeProvider";
import type { Editor as EditorType } from "@toast-ui/react-editor";
import styles from "./PostWriteForm.module.css";

// TOAST UI Editor는 SSR 미지원 → 클라이언트 전용 동적 임포트
const Editor = dynamic(
  () => import("@toast-ui/react-editor").then((m) => m.Editor),
  {
    ssr: false,
    loading: () => (
      <div className={styles.editorLoading}>에디터 로딩 중...</div>
    ),
  }
);

interface PostWriteFormProps {
  boardId: string;
}

// TOAST UI addImageBlobHook 콜백 타입
type ImageUploadCallback = (url: string, altText: string) => void;

export function PostWriteForm({ boardId }: PostWriteFormProps) {
  const editorRef = useRef<EditorType | null>(null);
  const { isDark } = useThemeContext();
  const { status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cssLoaded, setCssLoaded] = useState(false);

  // TOAST UI Editor CSS는 클라이언트에서만 로드 (SSR 오류 방지)
  useEffect(() => {
    const loadCss = async () => {
      await import("@toast-ui/editor/dist/toastui-editor.css");
      await import("@toast-ui/editor/dist/theme/toastui-editor-dark.css");
      setCssLoaded(true);
    };
    loadCss();
  }, []);

  // 클라이언트 측 인증 이중 보호
  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = encodeURIComponent(`/board/write?board=${boardId}`);
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [status, boardId, router]);

  // 이미지 업로드: blob → /api/upload-image → URL 반환
  const handleImageUpload = async (
    blob: Blob | File,
    callback: ImageUploadCallback
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
        const altText = blob instanceof File ? blob.name : "이미지";
        callback(data.url, altText);
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
    // 빈 에디터 체크: 내용 없음 또는 줄바꿈만 있는 경우
    const stripped = content.replace(/<[^>]+>/g, "").trim();
    const isEmptyEditor = !stripped || content === "<p><br></p>";
    if (isEmptyEditor) {
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

      {/* data-theme 속성으로 CSS 변수 기반 다크모드 오버라이드 적용 */}
      <div
        className={styles.editorWrap}
        data-theme={isDark ? "dark" : "light"}
      >
        {cssLoaded && (
          <Editor
            ref={editorRef}
            initialValue=""
            previewStyle="vertical"
            height="500px"
            initialEditType="wysiwyg"
            useCommandShortcut={true}
            theme={isDark ? "dark" : ""}
            hooks={{ addImageBlobHook: handleImageUpload }}
            placeholder="내용을 입력하세요..."
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
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}

export default PostWriteForm;
