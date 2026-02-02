'use client'

import React from 'react'
import Link from 'next/link'

import styles from './MessageBox.module.css'

export default function MessageBox() {
  return (
    <div className={styles.messagebox__wrap}>
      <div className={styles.main__text}>로그인 이후 이용할 수 있습니다.</div>
      <div className={styles.link__area}>
        <Link href="/login">로그인</Link>
      </div>
    </div>
  )
}
