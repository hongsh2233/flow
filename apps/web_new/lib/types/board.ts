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
  use_categories?: string;
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
  is_member_only?: string;
  member_only_grade?: 'all' | 'vip' | 'family';
  public_visibility?: 'full' | 'partial';
  created_at: string;
  updated_at: string;
  category?: string | null;
  category_id?: number | null;
  attachments?: PostAttachment[];
  board?: {
    id: string;
    name: string;
    type: string;
  };
  _blocked?: boolean;
  _block_reason?: string;
  _partial?: boolean;
}

// ── UI 컴포넌트 Props 타입 ──

export interface BoardListItem {
  id: number;
  title: string;
  summary: string;
  author: string;
  time: string;
  views: number;
  category?: string | null;
  tag: string | null;
  is_member_only?: boolean;
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
  category?: string | null;
  content: string;
  boardName?: string;
  attachments?: PostAttachment[];
  is_member_only?: boolean;
  _partial?: boolean;
  _block_reason?: string;
}

export interface BoardDetailProps {
  post: BoardPost;
  backHref?: string;
  backLabel?: string;
}
