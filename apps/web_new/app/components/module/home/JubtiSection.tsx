"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import styles from "./JubtiSection.module.css";
import questionPool from "@/lib/data/jubti-questions.json";
import { JUBTI_MASTER_BY_TYPE, MBTI_TO_JUBTI, MBTI_INVEST_DESCRIPTION, VALID_MBTI_TYPES } from "@/lib/jubti/jubtiMasters";

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
    master: JUBTI_MASTER_BY_TYPE.A,
    quote: "맞았나 틀렸나가 중요한 게 아니라, 맞았을 때 얼마를 벌었느냐가 중요하다.",
    advice: "변동성을 즐기되, 손실 한도를 정하고 리스크 관리 원칙을 세워두는 것이 중요합니다.",
    recommendedConcepts: ["레버리지·인버스", "손절·익절 전략", "수급·주체 동향"],
    tips: "기지 갖췄어 글쿨",
  },
  D: {
    label: "D (방어형)",
    characterName: "철벽 거북이",
    master: JUBTI_MASTER_BY_TYPE.D,
    quote: "10년을 보유할 주식이 아니라면 10분도 보유하지 마라.",
    advice: "단기 변동성에 흔들리기보다, 사업의 해자와 장기 경쟁력을 이해하는 데 시간을 써보세요.",
    recommendedConcepts: ["배당주·우량주", "안정성 지표(부채비율 등)", "거시 경제와 금리"],
    tips: "천천히, 꾸준히 가는 거북이가 결국 이긴다!",
  },
  N: {
    label: "N (분석형)",
    characterName: "돋보기 탐정",
    master: JUBTI_MASTER_BY_TYPE.N,
    quote: "큰 돈은 적게 사고 자주 파는 것이 아니라, 적게 사고 오래 보유하는 데서 나온다.",
    advice: "숫자 분석 능력에 더해, 경영진·산업 구조 등 정성적인 요소를 함께 보는 연습을 해보세요.",
    recommendedConcepts: ["재무제표 읽기", "밸류에이션(PER, PBR)", "기업지배구조·지분 구조"],
    tips: "데이터가 답을 알려줄 거예요!",
  },
  I: {
    label: "I (직관형)",
    characterName: "촉 좋은 야생마",
    master: JUBTI_MASTER_BY_TYPE.I,
    quote: "당신이 아는 것에 투자하라.",
    advice: "감각과 트렌드를 강점으로 삼되, 기본적인 재무 건전성과 리스크도 함께 체크해 보세요.",
    recommendedConcepts: ["차트·기술적 분석", "산업·섹터 트렌드", "공시·이벤트 해석"],
    tips: "빠른 판단력이 당신의 무기!",
  },
};

function pickMainType(scores: Record<Dimension, number>): Dimension {
  const max = Math.max(scores.A, scores.D, scores.N, scores.I);
  const candidates = (Object.keys(scores) as Dimension[]).filter((key) => scores[key] === max);
  for (const dim of PRIORITY) {
    if (candidates.includes(dim)) return dim;
  }
  return candidates[0] ?? "D";
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulo])/gm, "")
    .replace(/\n/g, "<br/>");
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
      <path d="M9 18h6" /><path d="M10 22h4" />
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

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function JubtiSection() {
  const { data: session, status } = useSession();
  const [isExpanded, setIsExpanded] = useState(false);
  const [questionsForRun, setQuestionsForRun] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>({ A: 0, D: 0, N: 0, I: 0 });
  const [finished, setFinished] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedJubtiType, setSavedJubtiType] = useState<Dimension | null>(null);

  // MBTI 상태
  const [savedMbtiType, setSavedMbtiType] = useState<string | null>(null);
  const [selectedMbti, setSelectedMbti] = useState<string | null>(null);
  const [showMbtiModal, setShowMbtiModal] = useState(false);
  const [isSavingMbti, setIsSavingMbti] = useState(false);
  const [showMbtiLoginMessage, setShowMbtiLoginMessage] = useState(false);

  // AI 전략 상태
  const [aiStrategy, setAiStrategy] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBoxRef = useRef<HTMLDivElement>(null);

  // 저장된 jubti_type 로드
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    fetch("/api/auth/member/jubti")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.jubti_type && ["A", "D", "N", "I"].includes(data.jubti_type)) {
          setSavedJubtiType(data.jubti_type as Dimension);
        }
      })
      .catch(() => {});
  }, [status, session?.user?.email]);

  // 저장된 mbti_type 로드
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    fetch("/api/auth/member/mbti")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.mbti_type) {
          setSavedMbtiType(data.mbti_type);
          setSelectedMbti(data.mbti_type);
        }
      })
      .catch(() => {});
  }, [status, session?.user?.email]);

  // 펼칠 때 MBTI 미설정이면 모달 자동 오픈
  useEffect(() => {
    if (!isExpanded) return;
    if (!savedMbtiType) setShowMbtiModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

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
    setAiStrategy("");
    initQuestions();
  };

  const handleSaveResult = async () => {
    if (status === "loading") return;
    if (!session?.user?.email) { setShowLoginMessage(true); return; }
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
        setSavedJubtiType(mainType);
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

  const openMbtiModal = () => {
    setShowMbtiLoginMessage(false);
    setShowMbtiModal(true);
  };

  const closeMbtiModal = () => {
    setShowMbtiModal(false);
    setShowMbtiLoginMessage(false);
  };

  const handleSaveMbti = async () => {
    if (!selectedMbti) return;
    if (!session?.user?.email) {
      setShowMbtiLoginMessage(true);
      return;
    }
    setIsSavingMbti(true);
    try {
      const res = await fetch("/api/auth/member/mbti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mbti_type: selectedMbti }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSavedMbtiType(selectedMbti);
        setShowMbtiModal(false);
        setShowMbtiLoginMessage(false);
      }
    } catch {
      // ignore
    } finally {
      setIsSavingMbti(false);
    }
  };

  const handleAiStrategy = async () => {
    if (!session?.user?.email) { setShowLoginMessage(true); return; }
    setAiLoading(true);
    setAiStrategy("");
    try {
      const res = await fetch("/api/jubti-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jubti_type: mainType,
          mbti_type: savedMbtiType,
          scores,
          character_name: meta.characterName,
          master: meta.master,
        }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiStrategy((prev) => prev + decoder.decode(value));
        aiBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch {
      setAiStrategy("AI 조언을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  // MBTI 설정 모달
  const mbtiModal = showMbtiModal ? (
    <div className={styles.overlay} onClick={closeMbtiModal} role="dialog" aria-modal="true" aria-label="MBTI 설정">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h4 className={styles.modalTitle}>내 MBTI 설정</h4>
          <button type="button" className={styles.modalClose} onClick={closeMbtiModal} aria-label="닫기">×</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalDesc}>MBTI를 입력하면 투자 성향과 연결된 맞춤 분석을 받을 수 있어요.</p>
          <div className={styles.mbtiGrid}>
            {VALID_MBTI_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`${styles.mbtiChip} ${selectedMbti === type ? styles.mbtiChipSelected : ""}`}
                onClick={() => setSelectedMbti(type)}
              >
                {type}
              </button>
            ))}
          </div>
          {selectedMbti && MBTI_INVEST_DESCRIPTION[selectedMbti] && (
            <p className={styles.mbtiDesc}>{MBTI_INVEST_DESCRIPTION[selectedMbti]}</p>
          )}
          {showMbtiLoginMessage && (
            <div className={styles.loginMessageStrip} role="alert">
              <p className={styles.loginMessageText}>로그인 후 저장할 수 있습니다.</p>
              <Link href="/login" className={styles.loginMessageLink}>로그인하기</Link>
              <button type="button" className={styles.loginMessageClose} onClick={() => setShowMbtiLoginMessage(false)} aria-label="닫기">×</button>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.skipBtn} onClick={closeMbtiModal}>
            건너뛰기
          </button>
          <button
            type="button"
            className={styles.mbtiSaveModalBtn}
            onClick={handleSaveMbti}
            disabled={!selectedMbti || isSavingMbti}
          >
            {isSavingMbti ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (!isExpanded) {
    const savedMeta = savedJubtiType ? TYPE_META[savedJubtiType] : null;
    const content = (
      <>
        <button
          type="button"
          onClick={() => { setQuestionsForRun(getRandomQuestions()); setIsExpanded(true); }}
          className={styles.collapsedBtn}
        >
          <div className={styles.collapsedInner}>
            <div className={styles.iconBox}><LightbulbIcon /></div>
            <div className={styles.collapsedText}>
              <h3 className={styles.collapsedTitle}>MBTI로 보는 투자성향</h3>
              <p className={styles.collapsedSubtitle}>
                {savedMeta
                  ? `${savedMeta.characterName} · ${savedMeta.label}${savedMbtiType ? ` · ${savedMbtiType}` : ""}`
                  : "MBTI × 투자심리 분석"}
              </p>
            </div>
          </div>
          <span className={styles.collapsedChevron}><ChevronDownIcon /></span>
        </button>
        {savedMeta && (
          <div className={styles.collapsedActions}>
            <button
              type="button"
              className={styles.retakeButton}
              onClick={(e) => {
                e.stopPropagation();
                handleRestart();
                setQuestionsForRun(getRandomQuestions());
                setIsExpanded(true);
              }}
            >
              <RotateIcon />
              <span>다시 하기</span>
            </button>
          </div>
        )}
      </>
    );
    return (
      <section className={styles.section}>
        {savedMeta ? <div className={styles.collapsedCard}>{content}</div> : content}
        {mbtiModal}
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.card}>
        <div className={styles.headerStrip}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}><LightbulbIcon /></span>
            <div>
              <h3 className={styles.headerTitle}>MBTI로 보는 투자성향</h3>
              <p className={styles.headerSubtitle}>
                {savedMbtiType
                  ? `MBTI: ${savedMbtiType}${MBTI_TO_JUBTI[savedMbtiType] ? ` · ${MBTI_TO_JUBTI[savedMbtiType]}형 연결` : ""}`
                  : "MBTI × 투자심리 분석"}
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={openMbtiModal} className={styles.gearBtn} aria-label="MBTI 설정">
              <GearIcon />
            </button>
            <button type="button" onClick={() => setIsExpanded(false)} className={styles.collapseBtn} aria-label="접기">
              <ChevronUpIcon />
            </button>
          </div>
        </div>

        {!finished ? (
          totalQuestions === 0 ? (
            <div className={styles.quizBody}><p className={styles.questionMeta}>질문 준비 중...</p></div>
          ) : (
            <div className={styles.quizBody}>
              <p className={styles.questionMeta}>질문 {currentIndex + 1} / {totalQuestions}</p>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }} />
              </div>
              <h4 className={styles.questionText}>{currentQuestion.text}</h4>
              <div className={styles.options}>
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleSelect(option, index)}
                    className={`${styles.optionButton} ${selectedOptionIndex === index ? styles.optionSelected : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className={styles.resultBody}>
            <p className={styles.resultMeta}>나의 MBTI 투자성향</p>
            <div className={`${styles.resultHero} ${styles[`resultHeroType${mainType}`]}`}>
              <h3 className={styles.resultHeroTitle}>{meta.characterName} · {meta.label}</h3>
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
              <div className={styles.adviceCard}><p className={styles.adviceText}>{meta.advice}</p></div>
            </div>

            <div className={styles.resultBlock}>
              <h4 className={styles.resultBlockLabel}>당신에게 필요한 지식</h4>
              <ul className={styles.knowledgeList}>
                {meta.recommendedConcepts.map((concept) => (
                  <li key={concept} className={styles.knowledgeItem}>{concept}</li>
                ))}
              </ul>
            </div>

            <div className={styles.tipsBox}>
              <p className={styles.tipsText}>💡 {meta.tips}</p>
            </div>

            {/* AI 전략 추천 */}
            {(() => {
              const grade = ((session?.user as { grade?: string })?.grade ?? "regular").trim().toLowerCase();
              const isVip = grade === "vip" || grade === "family";
              if (!session?.user) {
                return (
                  <div className={styles.loginMessageStrip} role="alert">
                    <p className={styles.loginMessageText}>로그인 후 이용 가능합니다.</p>
                    <Link href="/login" className={styles.loginMessageLink}>로그인하기</Link>
                  </div>
                );
              }
              if (!isVip) {
                return (
                  <div className={styles.vipLockStrip}>
                    <span className={styles.vipLockIcon}>🔒</span>
                    <p className={styles.vipLockText}>VIP 이상 회원만 이용할 수 있는 기능입니다.</p>
                  </div>
                );
              }
              return (
                <>
                  {aiStrategy ? (
                    <div
                      ref={aiBoxRef}
                      className={styles.aiStrategyBox}
                      dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(aiStrategy)}</p>` }}
                    />
                  ) : null}
                  {/* 준비 중 — 임시 비활성화
                  <button
                    type="button"
                    className={styles.aiStrategyBtn}
                    onClick={handleAiStrategy}
                    disabled={aiLoading}
                  >
                    {aiLoading ? "✨ AI 분석 중..." : "✨ AI 투자전략 추천받기"}
                  </button>
                  */}
                </>
              );
            })()}

            <div className={styles.actionRow}>
              <button type="button" className={styles.secondaryButton} onClick={handleRestart}>
                <RotateIcon /><span>다시하기</span>
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleSaveResult} disabled={isSaving}>
                <BookmarkIcon /><span>{isSaving ? "저장 중..." : "저장하기"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {mbtiModal}
    </section>
  );
}
