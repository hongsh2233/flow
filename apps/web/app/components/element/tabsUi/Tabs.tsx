'use client'

import React, { useState } from 'react'
import styles from './Tab.module.css'

interface TabsProps {
  children: React.ReactNode
}

export default function Tabs({ children }: TabsProps) {
  // 기본값을 첫 번째 인덱스인 '0'으로 설정
  const [activeValue, setActiveValue] = useState('0')

  // 자식 컴포넌트들에게 props를 주입 (TabList, TabPanel 등)
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        activeValue,
        setActiveValue,
      })
    }
    return child
  })

  return <div className={styles.tab__wrap}>{childrenWithProps}</div>
}
