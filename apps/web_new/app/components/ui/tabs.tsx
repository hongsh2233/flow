"use client";

import * as React from "react";
import type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
} from "@/lib/types";
import styles from "./Tabs.module.css";

const TabsContext = React.createContext<{
  value: string
  variant: "pill" | "underline"
  onValueChange: (value: string) => void
} | null>(null)

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  variant = "pill",
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternal] = React.useState(defaultValue ?? '')
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue
  const handleChange = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v)
      onValueChange?.(v)
    },
    [isControlled, onValueChange]
  )
  return (
    <TabsContext.Provider value={{ value: currentValue, variant, onValueChange: handleChange }}>
      <div
        data-slot="tabs"
        className={className ? `${styles.root} ${className}` : styles.root}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({
  className,
  children,
  ...props
}: TabsListProps) {
  const ctx = React.useContext(TabsContext)
  const base = ctx?.variant === "underline" ? styles.listUnderline : styles.list
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={className ? `${base} ${className}` : base}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs')
  const isActive = ctx.value === value
  const base = ctx.variant === "underline" ? styles.triggerUnderline : styles.trigger
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      data-slot="tabs-trigger"
      className={className ? `${base} ${className}` : base}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: TabsContentProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsContent must be used within Tabs')
  if (ctx.value !== value) return null
  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      className={className ? `${styles.content} ${className}` : styles.content}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
