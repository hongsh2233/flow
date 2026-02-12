// ── API 응답 타입 ──

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: PaginationInfo;
}

// ── 게시판(Board) 타입 ──

export interface Board {
  id: string;
  name: string;
  type: string;
  auth: string;
  created_at: string;
  updated_at: string;
  post_count: number;
}

// ── 게시글(Post) 타입 - API 응답 ──

export interface PostAttachment {
  filename: string;
  path: string;
  size?: number;
  type?: string;
  formatted_size?: string;
}

export interface PostFromApi {
  id: number;
  board_id: string;
  title: string;
  content: string;
  author: string;
  views: number;
  is_secret: string;
  created_at: string;
  updated_at: string;
  attachments?: PostAttachment[];
  board?: {
    id: string;
    name: string;
    type: string;
  };
}

// ── UI 컴포넌트 Props 타입 ──

export interface BoardListItem {
  id: number;
  title: string;
  summary: string;
  author: string;
  time: string;
  views: number;
  /* 댓글 기능 미구현 - 추후 추가 예정 */
  // comments: number;
  /* 카테고리 기능 미구현 - 추후 추가 예정 */
  // category: string;
  tag: string | null;
}

export interface BoardListProps {
  boardId?: string;
  items?: BoardListItem[];
  detailHref?: (id: number) => string;
  onLoadMore?: () => void;
  emptyMessage?: string;
}

export interface BoardPost {
  id: number;
  title: string;
  tag: string | null;
  author: string;
  time: string;
  views: number;
  /* 댓글 기능 미구현 - 추후 추가 예정 */
  // comments: number;
  /* 카테고리 기능 미구현 - 추후 추가 예정 */
  // category: string;
  content: string;
  boardName?: string;
  attachments?: PostAttachment[];
}

export interface BoardDetailProps {
  post: BoardPost;
  backHref?: string;
  backLabel?: string;
}
