'use client'

import * as React from 'react'
import { useState } from 'react'
import styles from './Accordion.module.css'

interface AccordionItem {
  id: string
  title: string
  content: React.ReactNode
}

interface AccordionProps {
  items: AccordionItem[]
  defaultOpenId?: string
}

export default function Accordion({ items, defaultOpenId }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId || null)

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <div className={styles.accordion}>
      {items.map((item) => {
        const isOpen = openId === item.id
        return (
          <div key={item.id} className={styles.accordionItem}>
            <div
              className={`${styles.accordionHeader} ${isOpen ? styles.active : ''}`}
              onClick={() => toggle(item.id)}
            >
              <div className={styles.accordionTitle}>{item.title}</div>
              <div className={styles.accordionIcon}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div
              className={`${styles.accordionContent} ${isOpen ? styles.active : ''}`}
            >
              <div className={styles.accordionBody}>{item.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

