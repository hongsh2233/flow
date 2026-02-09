export interface NewsItem {
  id: number;
  category: string;
  title: string;
  summary: string;
  time: string;
  tag: string | null;
}

export interface NewsListProps {
  items?: NewsItem[];
  onLoadMore?: () => void;
}
