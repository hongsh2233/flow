"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { StockTermBox } from "../components/module/stock-term-box";
import styles from "./Faq.module.css";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const FALLBACK_FAQ: FaqCategory[] = [
  {
    title: "계정",
    items: [
      { question: "회원가입은 어떻게 하나요?", answer: "앱 첫 화면에서 '회원가입' 버튼을 클릭하고 가입할 수 있습니다." },
      { question: "비밀번호를 잊어버렸어요.", answer: "로그인 화면에서 '비밀번호 찾기'를 클릭해주세요." },
      { question: "회원 탈퇴는 어떻게 하나요?", answer: "설정 > 내 정보 > 회원 탈퇴 메뉴에서 탈퇴할 수 있습니다." },
    ],
  },
  {
    title: "주식 정보",
    items: [
      { question: "주가 정보는 실시간인가요?", answer: "주가 정보는 약 15~20분 지연된 데이터입니다." },
      { question: "관심 종목은 몇 개까지 등록할 수 있나요?", answer: "관심 종목은 최대 50개까지 등록할 수 있습니다." },
    ],
  },
];

export default function FaqPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const [faqCategories, setFaqCategories] = useState<FaqCategory[]>(FALLBACK_FAQ);

  useEffect(() => {
    fetch("/api/faq")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setFaqCategories(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const toggle = (key: string) => {
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        {/* 상단 바 */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.topBarTitle}>자주하는 질문</h2>
          <div className={styles.topBarSpacer} />
        </div>
        <div style={{ margin: "0 0 1rem" }}>
          <StockTermBox />
        </div>
        {/* FAQ 목록 */}
        <div className={styles.categories}>
          {faqCategories.map((category, catIdx) => (
            <div key={catIdx} className={styles.category}>
              <h3 className={styles.categoryTitle}>{category.title}</h3>
              <div className={styles.categoryCard}>
                {category.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const isOpen = openIndex === key;
                  return (
                    <div
                      key={key}
                      className={`${styles.faqItem} ${
                        itemIdx !== category.items.length - 1
                          ? styles.faqItemBordered
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.faqQuestion}
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                      >
                        <span className={styles.questionText}>
                          {item.question}
                        </span>
                        <ChevronDown
                          size={18}
                          className={`${styles.chevron} ${
                            isOpen ? styles.chevronOpen : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className={styles.faqAnswer}>
                          <p>{item.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
