'use client'

import React from 'react'
import { formatDate } from '../../../src/utils/date'

interface PageTitleProps {
  label: string
  showDate?: boolean
  date?: string // [추가] 외부에서 전달받을 날짜 문자열
}

export default function PageTitle({
  label,
  showDate = false,
  date,
}: PageTitleProps) {
  // date가 있으면 그것을 사용하고, 없으면 showDate가 true일 때만 오늘 날짜를 계산
  const displayDate = date ? date : showDate ? formatDate(new Date()) : null

  return (
    <h2 className="page-title">
      {label}
      {displayDate && (
        <span className="page-title__date"> ({displayDate})</span>
      )}
    </h2>
  )
}
