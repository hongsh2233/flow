'use client'

import React from 'react'

interface IconButtonProps {
  iconName: string // 머티리얼 아이콘 이름 (예: 'arrow_back_ios')
  onClick?: () => void // 클릭 시 실행할 함수
  className?: string // 추가 스타일 클래스
  label: string // 웹 접근성용 라벨 (뒤로, 메뉴 등)
}

export default function IconButton({
  iconName,
  onClick,
  className = '',
  label,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`btn ${className}`}
      onClick={onClick}
      aria-label={label}
    >
      <img src={`/image/icon/${iconName}.svg`} alt={label} />
    </button>
  )
}
