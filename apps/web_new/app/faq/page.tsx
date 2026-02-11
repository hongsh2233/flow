"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import styles from "./Faq.module.css";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const faqCategories: FaqCategory[] = [
  {
    title: "계정",
    items: [
      {
        question: "회원가입은 어떻게 하나요?",
        answer:
          "앱 첫 화면에서 '회원가입' 버튼을 클릭하고, 이메일과 비밀번호를 입력하면 가입이 완료됩니다. 카카오, 네이버, 구글 소셜 계정으로도 간편하게 가입할 수 있습니다.",
      },
      {
        question: "비밀번호를 잊어버렸어요.",
        answer:
          "로그인 화면에서 '비밀번호 찾기'를 클릭하면 가입한 이메일로 비밀번호 재설정 링크가 발송됩니다. 메일함을 확인해주세요.",
      },
      {
        question: "회원 탈퇴는 어떻게 하나요?",
        answer:
          "설정 > 내 정보 > 회원 탈퇴 메뉴에서 탈퇴할 수 있습니다. 탈퇴 시 모든 데이터가 삭제되며 복구할 수 없으니 신중하게 결정해주세요.",
      },
    ],
  },
  {
    title: "주식 정보",
    items: [
      {
        question: "주가 정보는 실시간인가요?",
        answer:
          "주가 정보는 약 15~20분 지연된 데이터입니다. 실시간 시세는 증권사 앱을 참고해주세요. 주리니는 투자 학습과 포트폴리오 관리 목적으로 설계되었습니다.",
      },
      {
        question: "관심 종목은 몇 개까지 등록할 수 있나요?",
        answer:
          "관심 종목은 최대 50개까지 등록할 수 있습니다. 설정에서 관심 종목 목록을 관리할 수 있습니다.",
      },
      {
        question: "주식 용어가 어려워요.",
        answer:
          "홈 화면 하단의 '주식 용어 사전'에서 초보 투자자를 위한 용어 설명을 확인할 수 있습니다. 쉽고 친절한 설명으로 구성되어 있어요!",
      },
    ],
  },
  {
    title: "알림",
    items: [
      {
        question: "알림이 오지 않아요.",
        answer:
          "설정 > 알림 설정에서 푸시 알림이 켜져 있는지 확인해주세요. 또한 기기의 시스템 설정에서 주리니 앱의 알림 권한이 허용되어 있는지 확인해주세요.",
      },
      {
        question: "일정 알림은 무엇인가요?",
        answer:
          "배당금 지급일, 실적 발표일 등 투자와 관련된 주요 일정을 미리 알려주는 기능입니다. 설정 > 알림 설정에서 활성화할 수 있습니다.",
      },
    ],
  },
  {
    title: "기타",
    items: [
      {
        question: "간편 비밀번호 설정은 어떻게 하나요?",
        answer:
          "설정 > 앱 설정 > 간편 비밀번호 설정에서 4~6자리 숫자로 간편 비밀번호를 설정할 수 있습니다. 앱 실행 시 간편하게 본인 인증을 할 수 있습니다.",
      },
      {
        question: "앱에서 오류가 발생해요.",
        answer:
          "앱을 최신 버전으로 업데이트 해주세요. 문제가 계속되면 설정 화면 하단의 앱 버전 정보를 포함하여 고객센터로 문의해주세요.",
      },
    ],
  },
];

export default function FaqPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<string | null>(null);

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
