'use client'

import { signIn } from 'next-auth/react'
import styles from './Login.module.css'

export default function LoginPage() {
  const handleLogin = (provider: string) => {
    signIn(provider, { callbackUrl: '/' })
  }

  return (
    <div className={styles.login__wrap}>
      <div className={styles.login__content}>
        <div className={styles.login__message}>
          SNS 계정으로 로그인 해주세요.
        </div>
        <div className={styles.login__button_group}>
          {/* 구글 버튼 */}
          <button
            type="button"
            className={styles.btn_google}
            onClick={() => handleLogin('google')}
          >
            <img
              src="/image/icon/icon_google.png"
              alt="구글"
            />
            <span>구글 계정으로 로그인</span>
          </button>

          {/* 네이버 버튼 */}
          <button
            type="button"
            className={styles.btn_naver}
            onClick={() => handleLogin('naver')}
          >
            <span>N</span>
            <span>네이버 계정으로 로그인</span>
          </button>
        </div>
      </div>
    </div>
  )
}
