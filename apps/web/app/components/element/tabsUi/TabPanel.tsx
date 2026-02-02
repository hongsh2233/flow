// TabPanel.tsx
'use client'
import React from 'react'
import styles from './Tab.module.css'

export default function TabPanel({ children, activeValue }: any) {
  return (
    <div className={styles.tabPanelContent}>
      {React.Children.map(children, (child, index) => {
        // 현재 활성화된 인덱스와 일치하는 TabCont만 렌더링
        if (activeValue === index.toString()) return child
        return null
      })}
    </div>
  )
}
