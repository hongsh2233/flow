import { BookOpen, X } from "lucide-react";
import { useState } from "react";
import styles from "./stock-term-box.module.css";

const stockTerms = [
  {
    term: "시가총액",
    description: "회사의 주식 가격 × 발행된 주식 수. 쉽게 말하면 회사의 크기예요!"
  },
  {
    term: "거래량",
    description: "오늘 거래된 주식의 총 개수입니다. 많을수록 인기가 많다는 뜻이에요."
  },
  {
    term: "거래대금",
    description: "거래량 × 주가 = 실제로 거래된 총 금액이에요."
  },
  {
    term: "등락률",
    description: "어제 대비 오늘 주가가 얼마나 오르거나 내렸는지 %로 표시해요."
  },
  {
    term: "상한가",
    description: "하루에 오를 수 있는 최대 가격이에요. 보통 전일 대비 30%까지!"
  },
  {
    term: "하한가",
    description: "하루에 떨어질 수 있는 최저 가격이에요. 보통 전일 대비 -30%까지!"
  },
  {
    term: "배당금",
    description: "회사가 수익을 주주들에게 나눠주는 돈이에요. 주주 혜택!"
  },
  {
    term: "PER",
    description: "주가수익비율. 주가가 회사 이익에 비해 얼마나 비싼지 보는 지표예요."
  },
];

export function StockTermBox() {
  const [isVisible, setIsVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isVisible) return null;

  const currentTerm = stockTerms[currentIndex];

  const nextTerm = () => {
    setCurrentIndex((prev) => (prev + 1) % stockTerms.length);
  };

  return (
    <div className={styles.container}>
      <button
        onClick={() => setIsVisible(false)}
        className={styles.closeButton}
      >
        <X className={styles.closeIcon} />
      </button>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <BookOpen className={styles.bookIcon} />
        </div>
        <div className={styles.textArea}>
          <h4 className={styles.title}>
            📚 주식 용어: {currentTerm.term}
          </h4>
          <p className={styles.description}>
            {currentTerm.description}
          </p>
          <button
            onClick={nextTerm}
            className={styles.nextButton}
          >
            다음 용어 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}
