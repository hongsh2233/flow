"use client";

import { useMemo, useState } from "react";
import styles from "./JubtiSection.module.css";

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

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "큰 수익을 노릴 때, 나는...",
    options: [
      { label: "변동성이 크더라도 수익을 극대화하고 싶다", scores: { A: 2 } },
      { label: "손실을 최소화하는 게 더 중요하다", scores: { D: 2 } },
      { label: "과거 데이터와 재무지표부터 꼼꼼히 본다", scores: { N: 2 } },
      { label: "뉴스·이슈 흐름을 보며 감으로 판단한다", scores: { I: 2 } },
    ],
  },
  {
    id: 2,
    text: "투자 결정을 내릴 때 나는...",
    options: [
      { label: "타이밍이 왔다고 느끼면 과감히 진입한다", scores: { A: 2, I: 1 } },
      { label: "리스크를 줄일 수 있는 분할 매수를 선호한다", scores: { D: 2 } },
      { label: "재무제표·밸류에이션이 합리적일 때만 투자한다", scores: { N: 2 } },
      { label: "차트와 수급 흐름을 보며 직관적으로 판단한다", scores: { I: 2 } },
    ],
  },
  {
    id: 3,
    text: "주가가 급락했을 때 내 반응은?",
    options: [
      { label: "저가 매수 기회라고 생각하고 추가 매수한다", scores: { A: 2 } },
      { label: "손절 또는 비중 축소로 방어에 집중한다", scores: { D: 2 } },
      { label: "원인과 기업 펀더멘털을 먼저 분석해 본다", scores: { N: 2 } },
      { label: "시장 전체 분위기와 뉴스 흐름을 본다", scores: { I: 2 } },
    ],
  },
  {
    id: 4,
    text: "종목을 고를 때 나는...",
    options: [
      { label: "단기간에 크게 오를 수 있는 테마주·모멘텀주를 찾는다", scores: { A: 2 } },
      { label: "우량주·배당주 위주로 천천히 모은다", scores: { D: 2 } },
      { label: "ROE, 부채비율, PER 등 지표를 꼼꼼히 본다", scores: { N: 2 } },
      { label: "산업 트렌드·라이프스타일 변화를 떠올리며 고른다", scores: { I: 2 } },
    ],
  },
  {
    id: 5,
    text: "정보 수집 스타일은 어떤가요?",
    options: [
      { label: "속보성 뉴스와 이슈 위주로 확인한다", scores: { I: 2, A: 1 } },
      { label: "애널리스트 리포트·재무자료를 중심으로 본다", scores: { N: 2 } },
      { label: "장기적인 거시경제 흐름을 중시한다", scores: { D: 2 } },
      { label: "커뮤니티·SNS에서 투자 아이디어를 얻는다", scores: { I: 2 } },
    ],
  },
  {
    id: 6,
    text: "나의 투자 기간은 보통...",
    options: [
      { label: "단기·스윙 위주로 빠르게 대응한다", scores: { A: 2 } },
      { label: "수년 이상 가져갈 수 있는 기업을 찾는다", scores: { D: 2 } },
      { label: "목표가치에 도달할 때까지 기다린다", scores: { N: 2, D: 1 } },
      { label: "트렌드가 꺾인다고 느껴질 때까지 보유한다", scores: { I: 2 } },
    ],
  },
  {
    id: 7,
    text: "어떤 말이 더 나에게 와 닿나요?",
    options: [
      { label: "리스크 없이는 수익도 없다", scores: { A: 2 } },
      { label: "원금을 지키는 것이 최우선이다", scores: { D: 2 } },
      { label: "모르는 사업에는 투자하지 않는다", scores: { N: 2 } },
      { label: "세상의 변화는 차트보다 빠르다", scores: { I: 2 } },
    ],
  },
];

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
  }
> = {
  A: {
    label: "A (공격형)",
    characterName: "불나방 파이터",
    master: "조지 소로스",
    quote: "맞았나 틀렸나가 중요한 게 아니라, 맞았을 때 얼마를 벌었느냐가 중요하다.",
    advice: "변동성을 즐기되, 손실 한도를 정하고 리스크 관리 원칙을 세워두는 것이 중요합니다.",
    recommendedConcepts: ["레버리지·인버스", "손절·익절 전략", "수급·주체 동향"],
  },
  D: {
    label: "D (방어형)",
    characterName: "철벽 거북이",
    master: "워런 버핏",
    quote: "10년을 보유할 주식이 아니라면 10분도 보유하지 마라.",
    advice: "단기 변동성에 흔들리기보다, 사업의 해자와 장기 경쟁력을 이해하는 데 시간을 써보세요.",
    recommendedConcepts: ["배당주·우량주", "안정성 지표(부채비율 등)", "거시 경제와 금리"],
  },
  N: {
    label: "N (분석형)",
    characterName: "돋보기 탐정",
    master: "찰리 멍거",
    quote: "큰 돈은 적게 사고 자주 파는 것이 아니라, 적게 사고 오래 보유하는 데서 나온다.",
    advice: "숫자 분석 능력에 더해, 경영진·산업 구조 등 정성적인 요소를 함께 보는 연습을 해보세요.",
    recommendedConcepts: ["재무제표 읽기", "밸류에이션(PER, PBR)", "기업지배구조·지분 구조"],
  },
  I: {
    label: "I (직관형)",
    characterName: "촉 좋은 야생마",
    master: "피터 린치",
    quote: "당신이 아는 것에 투자하라.",
    advice: "감각과 트렌드를 강점으로 삼되, 기본적인 재무 건전성과 리스크도 함께 체크해 보세요.",
    recommendedConcepts: ["차트·기술적 분석", "산업·섹터 트렌드", "공시·이벤트 해석"],
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

export function JubtiSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>({
    A: 0,
    D: 0,
    N: 0,
    I: 0,
  });
  const [finished, setFinished] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const totalQuestions = QUESTIONS.length;
  const currentQuestion = QUESTIONS[currentIndex] ?? QUESTIONS[0];

  const mainType = useMemo(() => pickMainType(scores), [scores]);
  const meta = TYPE_META[mainType];

  const handleSelect = (option: QuestionOption) => {
    setActiveLabel(option.label);

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
    setActiveLabel(null);
  };

  const handleRestart = () => {
    setScores({ A: 0, D: 0, N: 0, I: 0 });
    setCurrentIndex(0);
    setFinished(false);
    setActiveLabel(null);
  };

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>주BTI</h3>
        <span className={styles.badge}>재미로 하는 투자 성향</span>
      </div>

      {!finished ? (
        <div className={styles.card}>
          <div className={styles.questionMeta}>
            <span>
              질문 {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
          <p className={styles.questionText}>{currentQuestion.text}</p>
          <div className={styles.options}>
            {currentQuestion.options.map((option) => {
              const isActive = activeLabel === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`${styles.optionButton} ${
                    isActive ? styles.optionActive : ""
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.resultMeta}>나의 투자 성향</div>
          <div className={styles.resultTitle}>
            {meta.characterName} · {meta.label}
          </div>

          <div className={styles.resultCard}>
            <div className={styles.resultLabel}>나와 닮은 투자 대가</div>
            <p className={styles.resultText}>
              {meta.master}
              <br />
              “{meta.quote}”
            </p>
          </div>

          <div className={styles.resultCard}>
            <div className={styles.resultLabel}>지금 당신에게 필요한 한 마디</div>
            <p className={styles.resultText}>{meta.advice}</p>
          </div>

          <div className={styles.resultCard}>
            <div className={styles.resultLabel}>당신에게 필요한 지식</div>
            <div className={styles.chipRow}>
              {meta.recommendedConcepts.map((concept) => (
                <span key={concept} className={styles.chip}>
                  {concept}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleRestart}
            >
              내 주BTI 다시 테스트하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

