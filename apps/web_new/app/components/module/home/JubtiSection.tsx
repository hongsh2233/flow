"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import styles from "./JubtiSection.module.css";
import questionPool from "@/lib/data/jubti-questions.json";

type Dimension = "A" | "D" | "N" | "I";

interface QuestionOption {
  label: string;
  scores: Partial<Record<Dimension, number>>;
}

interface Question {
  id: number;
  text: string;
  options: QuestionOption[];
}

const QUESTION_POOL = questionPool as Question[];

const QUESTIONS_PER_RUN = 7;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getRandomQuestions(): Question[] {
  return shuffle([...QUESTION_POOL]).slice(0, QUESTIONS_PER_RUN);
}

const PRIORITY: Dimension[] = ["D", "N", "A", "I"];

const TYPE_META: Record<
  Dimension,
  {
    label: string;
    characterName: string;
    master: string;
    quote: string;
    advice: string;
    recommendedConcepts: string[];
    tips: string;
  }
> = {
  A: {
    label: "A (공격형)",
    characterName: "불나방 파이터",
    master: "조지 소로스",
    quote: "맞았나 틀렸나가 중요한 게 아니라, 맞았을 때 얼마를 벌었느냐가 중요하다.",
    advice: "변동성을 즐기되, 손실 한도를 정하고 리스크 관리 원칙을 세워두는 것이 중요합니다.",
    recommendedConcepts: ["레버리지·인버스", "손절·익절 전략", "수급·주체 동향"],
    tips: "기지 갖췄어 글쿨",
  },
  D: {
    label: "D (방어형)",
    characterName: "철벽 거북이",
    master: "워런 버핏",
    quote: "10년을 보유할 주식이 아니라면 10분도 보유하지 마라.",
    advice: "단기 변동성에 흔들리기보다, 사업의 해자와 장기 경쟁력을 이해하는 데 시간을 써보세요.",
    recommendedConcepts: ["배당주·우량주", "안정성 지표(부채비율 등)", "거시 경제와 금리"],
    tips: "천천히, 꾸준히 가는 거북이가 결국 이긴다!",
  },
  N: {
    label: "N (분석형)",
    characterName: "돋보기 탐정",
    master: "찰리 멍거",
    quote: "큰 돈은 적게 사고 자주 파는 것이 아니라, 적게 사고 오래 보유하는 데서 나온다.",
    advice: "숫자 분석 능력에 더해, 경영진·산업 구조 등 정성적인 요소를 함께 보는 연습을 해보세요.",
    recommendedConcepts: ["재무제표 읽기", "밸류에이션(PER, PBR)", "기업지배구조·지분 구조"],
    tips: "데이터가 답을 알려줄 거예요!",
  },
  I: {
    label: "I (직관형)",
    characterName: "촉 좋은 야생마",
    master: "피터 린치",
    quote: "당신이 아는 것에 투자하라.",
    advice: "감각과 트렌드를 강점으로 삼되, 기본적인 재무 건전성과 리스크도 함께 체크해 보세요.",
    recommendedConcepts: ["차트·기술적 분석", "산업·섹터 트렌드", "공시·이벤트 해석"],
    tips: "빠른 판단력이 당신의 무기!",
  },
};

function pickMainType(scores: Record<Dimension, number>): Dimension {
  const max = Math.max(scores.A, scores.D, scores.N, scores.I);
  const candidates = (Object.keys(scores) as Dimension[]).filter(
    (key) => scores[key] === max,
  );
  for (const dim of PRIORITY) {
    if (candidates.includes(dim)) return dim;
  }
  return candidates[0] ?? "D";
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function JubtiSection() {
  const { data: session, status } = useSession();
  const [isExpanded, setIsExpanded] = useState(false);
  const [questionsForRun, setQuestionsForRun] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>({
    A: 0,
    D: 0,
    N: 0,
    I: 0,
  });
  const [finished, setFinished] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initQuestions = useCallback(() => {
    setQuestionsForRun(getRandomQuestions());
  }, []);

  const totalQuestions = questionsForRun.length;
  const currentQuestion = questionsForRun[currentIndex] ?? questionsForRun[0];

  const mainType = useMemo(() => pickMainType(scores), [scores]);
  const meta = TYPE_META[mainType];

  const handleSelect = (option: QuestionOption, index: number) => {
    setSelectedOptionIndex(index);
    setScores((prev) => {
      const next = { ...prev };
      (Object.keys(option.scores) as Dimension[]).forEach((dim) => {
        next[dim] += option.scores[dim] ?? 0;
      });
      return next;
    });

    if (currentIndex + 1 >= totalQuestions) {
      setFinished(true);
    } else {
      setCurrentIndex((idx) => idx + 1);
    }
    setSelectedOptionIndex(null);
  };

  const handleRestart = () => {
    setScores({ A: 0, D: 0, N: 0, I: 0 });
    setCurrentIndex(0);
    setFinished(false);
    setSelectedOptionIndex(null);
    setShowLoginMessage(false);
    initQuestions();
  };

  const handleSaveResult = async () => {
    if (status === "loading") return;
    if (!session?.user?.email) {
      setShowLoginMessage(true);
      return;
    }
    setIsSaving(true);
    setShowLoginMessage(false);
    try {
      const res = await fetch("/api/auth/member/jubti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jubti_type: mainType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert("결과가 저장되었습니다!");
        setIsExpanded(false);
      } else {
        alert(data.message ?? "저장에 실패했습니다.");
      }
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isExpanded) {
    return (
      <section className={styles.section}>
        <button
          type="button"
          onClick={() => {
            setQuestionsForRun(getRandomQuestions());
            setIsExpanded(true);
          }}
          className={styles.collapsedBtn}
        >
          <div className={styles.collapsedInner}>
            <div className={styles.iconBox}>
              <LightbulbIcon />
            </div>
            <div className={styles.collapsedText}>
              <h3 className={styles.collapsedTitle}>주BTI</h3>
              <p className={styles.collapsedSubtitle}>재미로 하는 투자 성향 테스트</p>
            </div>
          </div>
          <span className={styles.collapsedChevron}>
            <ChevronDownIcon />
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.card}>
        <div className={styles.headerStrip}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>
              <LightbulbIcon />
            </span>
            <div>
              <h3 className={styles.headerTitle}>주BTI</h3>
              <p className={styles.headerSubtitle}>재미로 하는 투자 성향 테스트</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className={styles.collapseBtn}
            aria-label="접기"
          >
            <ChevronUpIcon />
          </button>
        </div>

        {!finished ? (
          totalQuestions === 0 ? (
            <div className={styles.quizBody}>
              <p className={styles.questionMeta}>질문 준비 중...</p>
            </div>
          ) : (
          <div className={styles.quizBody}>
            <p className={styles.questionMeta}>
              질문 {currentIndex + 1} / {totalQuestions}
            </p>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>
            <h4 className={styles.questionText}>{currentQuestion.text}</h4>
            <div className={styles.options}>
              {currentQuestion.options.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleSelect(option, index)}
                  className={`${styles.optionButton} ${
                    selectedOptionIndex === index ? styles.optionSelected : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          )
        ) : (
          <div className={styles.resultBody}>
            <p className={styles.resultMeta}>나의 투자 성향</p>
            <div className={`${styles.resultHero} ${styles[`resultHeroType${mainType}`]}`}>
              <h3 className={styles.resultHeroTitle}>
                {meta.characterName} · {meta.label}
              </h3>
            </div>

            <div className={styles.resultBlock}>
              <h4 className={styles.resultBlockLabel}>나와 닮은 투자 대가</h4>
              <div className={styles.resultSubCard}>
                <p className={styles.resultSubTitle}>{meta.master}</p>
                <p className={styles.resultSubDesc}>&quot;{meta.quote}&quot;</p>
              </div>
            </div>

            <div className={styles.resultBlock}>
              <h4 className={styles.resultBlockLabel}>지금 당신에게 필요한 한 마디</h4>
              <div className={styles.adviceCard}>
                <p className={styles.adviceText}>{meta.advice}</p>
              </div>
            </div>

            <div className={styles.resultBlock}>
              <h4 className={styles.resultBlockLabel}>당신에게 필요한 지식</h4>
              <ul className={styles.knowledgeList}>
                {meta.recommendedConcepts.map((concept) => (
                  <li key={concept} className={styles.knowledgeItem}>
                    {concept}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.tipsBox}>
              <p className={styles.tipsText}>💡 {meta.tips}</p>
            </div>

            {showLoginMessage && (
              <div className={styles.loginMessageStrip} role="alert">
                <p className={styles.loginMessageText}>
                  로그인 후 이용 가능합니다.
                </p>
                <Link href="/login" className={styles.loginMessageLink}>
                  로그인하기
                </Link>
                <button
                  type="button"
                  className={styles.loginMessageClose}
                  onClick={() => setShowLoginMessage(false)}
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
            )}

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleRestart}
              >
                <RotateIcon />
                <span>다시하기</span>
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSaveResult}
                disabled={isSaving}
              >
                <BookmarkIcon />
                <span>{isSaving ? "저장 중..." : "저장하기"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
