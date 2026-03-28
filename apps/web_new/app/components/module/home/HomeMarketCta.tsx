import Link from "next/link";
import styles from "./HomeMarketCta.module.css";

export function HomeMarketCta() {
  return (
    <section className={styles.card} aria-label="AI 추천 종목 마켓 안내">
      <h2 className={styles.title}>AI 추천 종목</h2>
      <p className={styles.desc}>AI분석을 통해 추출한 스윙 및 종가매수 종목입니다.</p>
      <Link href="/market" className={styles.link}>
        종목 보러가기
        <span className={styles.chevron} aria-hidden>
          →
        </span>
      </Link>
    </section>
  );
}
