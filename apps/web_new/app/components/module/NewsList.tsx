"use client";

import { AccessTime } from "@mui/icons-material";
import type { NewsItem, NewsListProps } from "@/lib/types";
import styles from "./NewsList.module.css";

export type { NewsItem };

const defaultItems: NewsItem[] = [
  { id: 1, category: '경제', title: '삼성전자, 신규 반도체 공장 건설 발표', summary: '삼성전자가 차세대 반도체 생산을 위한 신규 공장 건설을 발표했습니다.', time: '10분 전', tag: '핫이슈' },
  { id: 2, category: '시장', title: '코스피, 외국인 순매수에 상승 마감', summary: '코스피 지수가 외국인 투자자들의 순매수에 힘입어 상승 마감했습니다.', time: '30분 전', tag: null },
  { id: 3, category: '기업', title: '네이버, AI 신기술 개발 성공', summary: '네이버가 새로운 인공지능 기술 개발에 성공하며 주가가 급등했습니다.', time: '1시간 전', tag: '주목' },
  { id: 4, category: '글로벌', title: '미국 증시, 빅테크 강세로 상승', summary: '미국 증시가 빅테크 기업들의 강세로 상승 마감했습니다.', time: '2시간 전', tag: null },
  { id: 5, category: '증권', title: '하반기 유망 업종 전망', summary: '증권가에서 하반기 유망 업종으로 2차전지와 바이오를 꼽았습니다.', time: '3시간 전', tag: '분석' },
]

export function NewsList({ items = defaultItems, onLoadMore }: NewsListProps) {
  return (
    <>
      <div className={styles.listWrap}>
        {items.map((news) => (
          <article key={news.id} className={styles.card}>
            <div className={styles.cardInner}>
              <div className={styles.content}>
                <div className={styles.tags}>
                  <span className={styles.category}>{news.category}</span>
                  {news.tag && <span className={styles.tag}>{news.tag}</span>}
                </div>
                <h3 className={styles.title}>{news.title}</h3>
                <p className={styles.summary}>{news.summary}</p>
                <div className={styles.timeRow}>
                  <span className={styles.timeIcon}><AccessTime fontSize="inherit" /></span>
                  <span>{news.time}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.moreWrap}>
        <button type="button" className={styles.moreBtn} onClick={onLoadMore}>
          더 많은 뉴스 보기
        </button>
      </div>
    </>
  )
}

export default NewsList
