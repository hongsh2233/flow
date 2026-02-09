"use client";

import Link from "next/link";
import { AccessTime, Visibility, Comment } from "@mui/icons-material";
import type { BoardListItem, BoardListProps } from "@/lib/types";
import styles from "./BoardList.module.css";

export type { BoardListItem };

const defaultItems: BoardListItem[] = [
  { id: 1, category: '마감시황', title: '코스피, 외국인 매수세에 1% 상승 마감', summary: '코스피가 외국인 투자자들의 순매수에 힘입어 1% 상승하며 2,456선에서 거래를 마쳤습니다. IT와 자동차 업종이 강세를 보였습니다.', author: '시황팀', time: '30분 전', views: 1234, comments: 45, tag: 'HOT' },
  { id: 2, category: '마감시황', title: '코스닥, 개인 매도세에 소폭 하락', summary: '코스닥은 개인 투자자들의 매도 물량이 나오며 0.5% 하락했습니다. 바이오와 IT 중소형주 위주로 약세를 보였습니다.', author: '시황팀', time: '1시간 전', views: 892, comments: 23, tag: null },
  { id: 3, category: '상한가 분석', title: '삼성전자, 실적 호조에 상한가 근접', summary: '삼성전자가 4분기 실적 호조 전망에 힘입어 장중 상한가에 근접했습니다. 반도체 업황 개선 기대감이 반영된 것으로 보입니다.', author: '종목분석팀', time: '2시간 전', views: 2156, comments: 78, tag: '분석' },
  { id: 4, category: '상한가 분석', title: '에코프로 상한가, 2차전지 수혜주 강세', summary: '에코프로가 전기차 배터리 수요 증가 소식에 상한가를 기록했습니다. 2차전지 관련주들이 일제히 강세를 보이고 있습니다.', author: '종목분석팀', time: '3시간 전', views: 1876, comments: 56, tag: '분석' },
  { id: 5, category: '마감시황', title: '미국 증시 영향, 국내 증시 혼조세', summary: '전날 미국 증시가 혼조세를 보인 영향으로 국내 증시도 방향성을 찾지 못하고 등락을 반복했습니다.', author: '시황팀', time: '4시간 전', views: 1234, comments: 34, tag: null },
]

export function BoardList({
  items = defaultItems,
  detailHref = (id) => `/report/${id}`,
  onLoadMore,
}: BoardListProps) {
  return (
    <>
      <div className={styles.listWrap}>
        {items.map((post) => {
          const isClosing = post.category === '마감시황'
          const categoryClass = isClosing ? styles.categoryClosing : styles.categoryDefault
          return (
            <Link
              key={post.id}
              href={detailHref(post.id)}
              className={styles.card}
            >
              <div className={styles.cardInner}>
                <div className={styles.content}>
                  <div className={styles.tags}>
                    <span className={`${styles.category} ${categoryClass}`}>
                      {post.category}
                    </span>
                    {post.tag && (
                      <span className={styles.tag}>{post.tag}</span>
                    )}
                  </div>
                  <h3 className={styles.title}>{post.title}</h3>
                  <p className={styles.summary}>{post.summary}</p>
                  <div className={styles.row}>
                    <div className={styles.left}>
                      <span>{post.author}</span>
                      <div className={styles.timeWrap}>
                        <span className={styles.timeIcon}>
                          <AccessTime fontSize="inherit" />
                        </span>
                        <span>{post.time}</span>
                      </div>
                    </div>
                    <div className={styles.right}>
                      <span className={styles.stat}>
                        <span className={styles.statIcon}>
                          <Visibility fontSize="inherit" />
                        </span>
                        {post.views.toLocaleString()}
                      </span>
                      <span className={styles.stat}>
                        <span className={styles.statIcon}>
                          <Comment fontSize="inherit" />
                        </span>
                        {post.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className={styles.moreWrap}>
        <button type="button" className={styles.moreBtn} onClick={onLoadMore}>
          더 많은 리포트 보기
        </button>
      </div>
    </>
  )
}

export default BoardList
