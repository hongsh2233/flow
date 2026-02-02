'use client'

import React from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className={styles.modal__overlay} onClick={onClose}>
      <div className={styles.modal__content} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modal__header}>
          <h2 className={styles.modal__title}>{title}</h2>
          <button className={styles.modal__close} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modal__body}>{children}</div>
      </div>
    </div>
  )
}
