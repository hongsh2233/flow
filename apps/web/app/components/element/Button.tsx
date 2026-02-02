'use client'

import React, { useState } from 'react' // useState 추가
import styles from './Button.module.css'

interface ButtonProps {
  isFavorite?: boolean
  onClick?: (isFav: boolean) => void // 클릭 시 바뀐 상태를 부모에게 알려줌
  className?: string
  label: string
}

export default function Button({
  isFavorite = false,
  onClick,
  className = '',
  label,
}: ButtonProps) {
  // 1. 내부 상태 선언 (초기값은 부모가 준 값)
  const [active, setActive] = useState(isFavorite)

  const handleToggle = (e: React.MouseEvent) => {
    const nextState = !active
    setActive(nextState) // 2. 자신의 상태를 변경

    if (onClick) {
      onClick(nextState) // 3. 필요한 경우 부모에게 알림
    }
  }

  return (
    <button
      type="button"
      className={`${styles.favorite_btn} ${
        active ? styles.active : '' // active 상태에 따라 클래스 부여
      } ${className}`}
      onClick={handleToggle}
      aria-label={label}
    >
      {active ? '★' : '☆'}
    </button>
  )
}
