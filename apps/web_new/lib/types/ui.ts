import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type TabsVariant = "pill" | "underline";

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  children?: ReactNode;
}

export interface TabsListProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: ReactNode;
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  value: string;
  children?: ReactNode;
}

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  value: string;
  children?: ReactNode;
}

export interface FormFieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  id?: string;
  readOnly?: boolean;
}

export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
}

export type SocialProvider = "kakao" | "naver" | "google";

export interface AdBannerItem {
  title: string;
  description?: string;
  label?: string;
  emoji?: string;
  href?: string;
  imageUrl?: string;
  htmlContent?: string;
  gradient?: "orange" | "blue" | "green" | "dark";
  closeable?: boolean;
}

/** 배너관리 API 응답 아이템 (managed) */
export interface ManagedBannerItem {
  id: number;
  display_type: "single" | "slide";
  content_type: "image" | "html";
  image_url: string | null;
  html_content: string | null;
  link_url: string | null;
  alt_text: string | null;
  order_index: number;
  slide_group: string | null;
}
