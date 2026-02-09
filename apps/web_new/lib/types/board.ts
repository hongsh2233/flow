export interface BoardListItem {
  id: number;
  category: string;
  title: string;
  summary: string;
  author: string;
  time: string;
  views: number;
  comments: number;
  tag: string | null;
}

export interface BoardListProps {
  items?: BoardListItem[];
  detailHref?: (id: number) => string;
  onLoadMore?: () => void;
}

export interface BoardPost {
  id: number;
  title: string;
  category: string;
  tag: string | null;
  author: string;
  time: string;
  views: number;
  comments: number;
  content: string;
}

export interface BoardDetailProps {
  post: BoardPost;
  backHref?: string;
  backLabel?: string;
}
