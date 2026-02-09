"use client";

import styles from "./Header.module.css";

export default function Header() {
    return (
        <div className={styles.header__wrap}>
            <h2 className={styles.title}>안녕하세요, 주린이님! 👋</h2>
            <p className={styles.subtitle}>오늘도 현명한 투자 되세요!</p>
        </div>
    )
}
