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
  /** 비밀번호 필드 우측 표시/숨김 토글 (type이 password일 때만 동작) */
  showPasswordToggle?: boolean;
  maxLength?: number;
}

export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
}

// 네이버 소셜 로그인 비활성화 — 기존: "kakao" | "naver" | "google"
export type SocialProvider = "kakao" | "google";

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
  /** 노출 위치: top(페이지 상단), bottom(페이지 하단) */
  position?: "top" | "bottom";
}
