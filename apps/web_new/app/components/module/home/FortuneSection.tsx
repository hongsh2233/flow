"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import styles from "./FortuneSection.module.css";
import {
  ZODIAC_ANIMALS,
  ZODIAC_ANIMAL_EMOJI,
  ZODIAC_SIGNS,
  ZODIAC_SIGN_EMOJI,
  getZodiacSignFromDate,
  getZodiacAnimalFromYear,
  type ZodiacAnimal,
  type ZodiacSign,
} from "@/lib/utils/zodiacUtils";

interface FortuneData {
  fortune_text: string;
  investment_tip?: string;
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

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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

export function FortuneSection() {
  const { data: session, status } = useSession();
  const [isExpanded, setIsExpanded] = useState(false);

  // Profile data loaded from API
  const [savedAnimal, setSavedAnimal] = useState<ZodiacAnimal | null>(null);
  const [savedSign, setSavedSign] = useState<ZodiacSign | null>(null);
  const [jubtiType, setJubtiType] = useState<string | null>(null);
  const [mbtiType, setMbtiType] = useState<string | null>(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<ZodiacAnimal | null>(null);
  const [selectedSign, setSelectedSign] = useState<ZodiacSign | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);

  // Fortune data
  const [activeAnimal, setActiveAnimal] = useState<ZodiacAnimal | null>(null);
  const [activeSign, setActiveSign] = useState<ZodiacSign | null>(null);
  const [animalFortune, setAnimalFortune] = useState<FortuneData | null>(null);
  const [signFortune, setSignFortune] = useState<FortuneData | null>(null);
  const [isLoadingFortune, setIsLoadingFortune] = useState(false);

  // AI advice
  const [aiAdvice, setAiAdvice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBoxRef = useRef<HTMLDivElement>(null);

  // Load saved zodiac + jubti/mbti when authenticated
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    fetch("/api/auth/member/zodiac")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          const animal = data.zodiac_animal as ZodiacAnimal | null;
          const sign = data.zodiac_sign as ZodiacSign | null;
          if (animal) { setSavedAnimal(animal); setSelectedAnimal(animal); }
          if (sign) { setSavedSign(sign); setSelectedSign(sign); }
        }
      })
      .catch(() => {});
    fetch("/api/auth/member/jubti")
      .then((r) => r.json())
      .then((data) => { if (data?.success && data.jubti_type) setJubtiType(data.jubti_type); })
      .catch(() => {});
    fetch("/api/auth/member/mbti")
      .then((r) => r.json())
      .then((data) => { if (data?.success && data.mbti_type) setMbtiType(data.mbti_type); })
      .catch(() => {});
  }, [status, session?.user?.email]);

  // Auto-calculate animal from birth year
  useEffect(() => {
    const y = parseInt(birthYear);
    if (y && y >= 1900 && y <= 2024) setSelectedAnimal(getZodiacAnimalFromYear(y));
  }, [birthYear]);

  // Auto-calculate sign from birth month+day
  useEffect(() => {
    const m = parseInt(birthMonth);
    const d = parseInt(birthDay);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const sign = getZodiacSignFromDate(m, d);
      if (sign) setSelectedSign(sign);
    }
  }, [birthMonth, birthDay]);

  const fetchFortunes = useCallback(async (animal: ZodiacAnimal | null, sign: ZodiacSign | null) => {
    if (!animal && !sign) return;
    setIsLoadingFortune(true);
    setAnimalFortune(null);
    setSignFortune(null);
    try {
      const [animalRes, signRes] = await Promise.all([
        animal
          ? fetch(`/api/fortune/today?fortune_type=animal&key=${encodeURIComponent(animal)}`).then((r) => r.json())
          : Promise.resolve(null),
        sign
          ? fetch(`/api/fortune/today?fortune_type=sign&key=${encodeURIComponent(sign)}`).then((r) => r.json())
          : Promise.resolve(null),
      ]);
      if (animalRes?.success) setAnimalFortune({ fortune_text: animalRes.fortune_text, investment_tip: animalRes.investment_tip });
      if (signRes?.success) setSignFortune({ fortune_text: signRes.fortune_text, investment_tip: signRes.investment_tip });
    } catch {
      // ignore
    } finally {
      setIsLoadingFortune(false);
    }
  }, []);

  // When expanding, load fortunes or open settings if nothing saved
  useEffect(() => {
    if (!isExpanded) return;
    if (savedAnimal || savedSign) {
      setActiveAnimal(savedAnimal);
      setActiveSign(savedSign);
      fetchFortunes(savedAnimal, savedSign);
    } else {
      setShowSettings(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const openSettings = () => {
    // Pre-fill picker with currently active values
    if (activeAnimal) setSelectedAnimal(activeAnimal);
    if (activeSign) setSelectedSign(activeSign);
    setShowLoginMessage(false);
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
    setShowLoginMessage(false);
  };

  const handleViewOnly = () => {
    if (!selectedAnimal && !selectedSign) return;
    setActiveAnimal(selectedAnimal);
    setActiveSign(selectedSign);
    setShowSettings(false);
    fetchFortunes(selectedAnimal, selectedSign);
  };

  const handleSaveToProfile = async () => {
    if (status !== "authenticated" || !session?.user?.email) {
      setShowLoginMessage(true);
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/member/zodiac", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zodiac_animal: selectedAnimal ?? null, zodiac_sign: selectedSign ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (selectedAnimal) setSavedAnimal(selectedAnimal);
        if (selectedSign) setSavedSign(selectedSign);
        setActiveAnimal(selectedAnimal);
        setActiveSign(selectedSign);
        setShowSettings(false);
        fetchFortunes(selectedAnimal, selectedSign);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiAdvice = async () => {
    if (status !== "authenticated" || !session?.user?.email) {
      setShowLoginMessage(true);
      return;
    }
    if (!jubtiType) return;
    setAiLoading(true);
    setAiAdvice("");
    try {
      const res = await fetch("/api/mbti-investment-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jubti_type: jubtiType,
          mbti_type: mbtiType ?? null,
          zodiac_animal: activeAnimal,
          zodiac_sign: activeSign,
          animal_fortune: animalFortune,
          sign_fortune: signFortune,
          scores: null,
          character_name: null,
        }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiAdvice((prev) => prev + decoder.decode(value));
        aiBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch {
      setAiAdvice("AI 조언을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const collapsedSubtitle = savedAnimal || savedSign
    ? [
        savedAnimal ? `${ZODIAC_ANIMAL_EMOJI[savedAnimal]}${savedAnimal}띠` : null,
        savedSign ? `${ZODIAC_SIGN_EMOJI[savedSign]}${savedSign}` : null,
      ].filter(Boolean).join(" · ")
    : "띠·별자리 운세 + AI 투자 조언";

  // Settings modal (rendered outside the card via portal-like approach)
  const settingsModal = showSettings ? (
    <div className={styles.overlay} onClick={closeSettings} role="dialog" aria-modal="true" aria-label="띠·별자리 설정">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h4 className={styles.modalTitle}>띠·별자리 설정</h4>
          <button type="button" className={styles.modalClose} onClick={closeSettings} aria-label="닫기">×</button>
        </div>

        <div className={styles.modalBody}>
          {/* 띠 선택 */}
          <div className={styles.setupStep}>
            <h5 className={styles.setupLabel}>🐾 나의 띠</h5>
            <div className={styles.animalGrid}>
              {ZODIAC_ANIMALS.map((animal) => (
                <button
                  key={animal}
                  type="button"
                  className={`${styles.animalChip} ${selectedAnimal === animal ? styles.animalChipSelected : ""}`}
                  onClick={() => setSelectedAnimal(animal)}
                >
                  {ZODIAC_ANIMAL_EMOJI[animal]}<br />{animal}
                </button>
              ))}
            </div>
            <div className={styles.birthRow}>
              <input
                type="number"
                placeholder="출생연도 (예: 1990)"
                className={styles.birthInput}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                min={1900}
                max={2024}
              />
              {selectedAnimal && birthYear && (
                <span className={styles.autoCalcBadge}>→ {ZODIAC_ANIMAL_EMOJI[selectedAnimal]} {selectedAnimal}띠</span>
              )}
            </div>
          </div>

          {/* 별자리 선택 */}
          <div className={styles.setupStep}>
            <h5 className={styles.setupLabel}>⭐ 나의 별자리</h5>
            <div className={styles.signGrid}>
              {ZODIAC_SIGNS.map((sign) => (
                <button
                  key={sign}
                  type="button"
                  className={`${styles.signChip} ${selectedSign === sign ? styles.signChipSelected : ""}`}
                  onClick={() => setSelectedSign(sign)}
                >
                  {ZODIAC_SIGN_EMOJI[sign]}<br /><span className={styles.signName}>{sign}</span>
                </button>
              ))}
            </div>
            <div className={styles.birthRow}>
              <input
                type="number"
                placeholder="월 (1~12)"
                className={styles.birthInputSmall}
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                min={1}
                max={12}
              />
              <input
                type="number"
                placeholder="일 (1~31)"
                className={styles.birthInputSmall}
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                min={1}
                max={31}
              />
              {selectedSign && (birthMonth || birthDay) && (
                <span className={styles.autoCalcBadge}>→ {ZODIAC_SIGN_EMOJI[selectedSign]} {selectedSign}</span>
              )}
            </div>
          </div>

          {showLoginMessage && (
            <div className={styles.loginMessageStrip} role="alert">
              <p className={styles.loginMessageText}>로그인 후 저장할 수 있습니다.</p>
              <Link href="/login" className={styles.loginMessageLink}>로그인하기</Link>
              <button type="button" className={styles.loginMessageClose} onClick={() => setShowLoginMessage(false)} aria-label="닫기">×</button>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.viewOnlyBtn}
            onClick={handleViewOnly}
            disabled={!selectedAnimal && !selectedSign}
          >
            운세만 보기
          </button>
          <button
            type="button"
            className={styles.saveProfileBtn}
            onClick={handleSaveToProfile}
            disabled={(!selectedAnimal && !selectedSign) || isSaving}
          >
            {isSaving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (!isExpanded) {
    return (
      <section className={styles.section}>
        <button type="button" onClick={() => setIsExpanded(true)} className={styles.collapsedBtn}>
          <div className={styles.collapsedInner}>
            <div className={styles.iconBox}><StarIcon /></div>
            <div className={styles.collapsedText}>
              <h3 className={styles.collapsedTitle}>오늘의 운세</h3>
              <p className={styles.collapsedSubtitle}>{collapsedSubtitle}</p>
            </div>
          </div>
          <span className={styles.collapsedChevron}><ChevronDownIcon /></span>
        </button>
        {settingsModal}
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.card}>
        <div className={styles.headerStrip}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}><StarIcon /></span>
            <div>
              <h3 className={styles.headerTitle}>오늘의 운세</h3>
              <p className={styles.headerSubtitle}>
                {activeAnimal || activeSign
                  ? [
                      activeAnimal ? `${ZODIAC_ANIMAL_EMOJI[activeAnimal]}${activeAnimal}띠` : null,
                      activeSign ? `${ZODIAC_SIGN_EMOJI[activeSign]}${activeSign}` : null,
                    ].filter(Boolean).join(" · ")
                  : "띠·별자리 + AI 투자 조언"}
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={openSettings} className={styles.gearBtn} aria-label="띠·별자리 설정">
              <GearIcon />
            </button>
            <button type="button" onClick={() => setIsExpanded(false)} className={styles.collapseBtn} aria-label="접기">
              <ChevronUpIcon />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {isLoadingFortune ? (
            <p className={styles.loadingText}>오늘의 운세 불러오는 중...</p>
          ) : !activeAnimal && !activeSign ? (
            <div className={styles.emptyState}>
              <p>⚙️ 위 설정 버튼을 눌러 띠와 별자리를 입력하면</p>
              <p>오늘의 운세를 확인할 수 있어요</p>
            </div>
          ) : (
            <>
              {animalFortune && activeAnimal && (
                <div className={`${styles.fortuneCard} ${styles.fortuneCardAnimal}`}>
                  <div className={styles.fortuneCardHeader}>
                    <span className={styles.fortuneEmoji}>{ZODIAC_ANIMAL_EMOJI[activeAnimal]}</span>
                    <span className={styles.fortuneCardTitle}>{activeAnimal}띠 오늘의 운세</span>
                  </div>
                  <p className={styles.fortuneText}>{animalFortune.fortune_text}</p>
                  {animalFortune.investment_tip && (
                    <p className={styles.investTip}>💰 {animalFortune.investment_tip}</p>
                  )}
                </div>
              )}
              {signFortune && activeSign && (
                <div className={`${styles.fortuneCard} ${styles.fortuneCardSign}`}>
                  <div className={styles.fortuneCardHeader}>
                    <span className={styles.fortuneEmoji}>{ZODIAC_SIGN_EMOJI[activeSign]}</span>
                    <span className={styles.fortuneCardTitle}>{activeSign} 오늘의 운세</span>
                  </div>
                  <p className={styles.fortuneText}>{signFortune.fortune_text}</p>
                  {signFortune.investment_tip && (
                    <p className={styles.investTip}>💰 {signFortune.investment_tip}</p>
                  )}
                </div>
              )}
              {!animalFortune && !signFortune && (
                <p className={styles.noFortuneText}>오늘의 운세를 준비 중입니다. 잠시 후 다시 확인해 주세요.</p>
              )}
            </>
          )}

          {/* AI 투자 조언 */}
          {aiAdvice ? (
            <div
              ref={aiBoxRef}
              className={styles.aiAdviceBox}
              dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(aiAdvice)}</p>` }}
            />
          ) : null}

          {(animalFortune || signFortune) && (() => {
            const grade = ((session?.user as { grade?: string })?.grade ?? "regular").trim().toLowerCase();
            const isVip = grade === "vip" || grade === "family";
            if (!session?.user) {
              return (
                <div className={styles.loginMessageStrip} role="alert">
                  <p className={styles.loginMessageText}>로그인 후 이용 가능합니다.</p>
                  <Link href="/login" className={styles.loginMessageLink}>로그인하기</Link>
                  <button type="button" className={styles.loginMessageClose} onClick={() => setShowLoginMessage(false)} aria-label="닫기">×</button>
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
            if (!jubtiType) {
              return (
                <p className={styles.noJubtiNote}>
                  MBTI 투자성향 테스트 후 AI 투자 종합 조언을 받아보세요
                </p>
              );
            }
            return (
              <button
                type="button"
                className={styles.aiAdviceBtn}
                onClick={handleAiAdvice}
                disabled={aiLoading}
              >
                {aiLoading ? "🌟 AI 분석 중..." : "🌟 오늘의 AI 투자 종합 조언"}
              </button>
            );
          })()}
        </div>
      </div>

      {settingsModal}
    </section>
  );
}
