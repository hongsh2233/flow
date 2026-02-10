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
}

export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export type SocialProvider = "kakao" | "naver" | "google";
