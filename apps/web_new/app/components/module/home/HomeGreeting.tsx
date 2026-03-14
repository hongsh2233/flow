import styles from "./HomeGreeting.module.css";

export function HomeGreeting() {
  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>안녕하세요, 투자자님! 👋</h2>
      <p className={styles.subtitle}>오늘도 현명한 투자 되세요!</p>
    </div>
  );
}
