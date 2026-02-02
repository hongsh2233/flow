'use client'

import React from 'react'
import styles from './AsyncContent.module.css'

interface AsyncContentProps<T> {
  loading: boolean
  error: string | null
  data: T[]
  emptyMessage?: string
  loadingMessage?: string
  hideErrorMessage?: boolean
  children: (data: T[]) => React.ReactNode
}

export default function AsyncContent<T>({
  loading,
  error,
  data,
  emptyMessage = '데이터가 없습니다.',
  loadingMessage = '로딩 중...',
  hideErrorMessage = false,
  children,
}: AsyncContentProps<T>) {
  if (loading) {
    return <div className={styles.loading}>{loadingMessage}</div>
  }

  if (error && !hideErrorMessage) {
    return <div className={styles.error}>{error}</div>
  }

  if (!loading && !error && data.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>
  }

  if (!loading && !error && data.length > 0) {
    return <>{children(data)}</>
  }

  return null
}
