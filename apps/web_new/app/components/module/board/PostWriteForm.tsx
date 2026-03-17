"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useThemeContext } from "@/app/components/providers/ThemeProvider";
import styles from "./PostWriteForm.module.css";

interface PostWriteFormProps {
  boardId: string;
}

type ImageUploadCallback = (url: string, altText: string) => void;

// @toast-ui/editor 인스턴스 타입 (최소 필요한 메서드만 선언)
interface ToastEditorInstance {
  getHTML(): string;
  destroy(): void;
}

export function PostWriteForm({ boardId }: PostWriteFormProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorInstanceRef = useRef<ToastEditorInstance | null>(null);
  const { isDark } = useThemeContext();
  const { status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editorReady, setEditorReady] = useState(false);

  // 클라이언트 측 인증 보호
  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = encodeURIComponent(`/board/write?board=${boardId}`);
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [status, boardId, router]);

  // 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (
    blob: Blob | File,
    callback: ImageUploadCallback
  ) => {
    const formData = new FormData();
    formData.append("file", blob);
    try {
      const res = await fetch("/api/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        callback(data.url, blob instanceof File ? blob.name : "이미지");
      } else {
        alert("이미지 업로드에 실패했습니다.");
      }
    } catch {
      alert("이미지 업로드 중 오류가 발생했습니다.");
    }
  }, []);

  // @toast-ui/editor 동적 로드 및 초기화 (SSR 없이 클라이언트 전용)
  useEffect(() => {
    if (!editorContainerRef.current || editorInstanceRef.current) return;

    let destroyed = false;

    const initEditor = async () => {
      // CSS 로드
      await import("@toast-ui/editor/dist/toastui-editor.css");
      if (isDark) {
        await import("@toast-ui/editor/dist/theme/toastui-editor-dark.css");
      }

      if (destroyed || !editorContainerRef.current) return;

      // 순수 JS Editor 동적 import
      const { default: Editor } = await import("@toast-ui/editor");

      if (destroyed || !editorContainerRef.current) return;

      editorInstanceRef.current = new Editor({
        el: editorContainerRef.current,
        height: "500px",
        initialEditType: "wysiwyg",
        previewStyle: "vertical",
        theme: isDark ? "dark" : "",
        placeholder: "내용을 입력하세요...",
        useCommandShortcut: true,
        hooks: { addImageBlobHook: handleImageUpload },
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task", "indent", "outdent"],
          ["table", "image", "link"],
          ["code", "codeblock"],
        ],
      }) as ToastEditorInstance;

      setEditorReady(true);
    };

    initEditor();

    return () => {
      destroyed = true;
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
    };
    // isDark는 초기 마운트 시 한 번만 적용 (이후 CSS 오버라이드로 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleImageUpload]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }

    const instance = editorInstanceRef.current;
    if (!instance) return;

    const content = instance.getHTML();
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

      {/* data-theme 속성으로 CSS 변수 기반 다크모드 오버라이드 */}
      <div
        className={styles.editorWrap}
        data-theme={isDark ? "dark" : "light"}
      >
        {!editorReady && (
          <div className={styles.editorLoading}>에디터 로딩 중...</div>
        )}
        <div ref={editorContainerRef} />
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
