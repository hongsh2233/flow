"use client";

import styles from "./JuTalkPage.module.css";
import { Clock, MessageCircle, Heart } from "lucide-react";
import { StockTermBox } from "../components/module/stock-term-box";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";
import type {
  Expert,
  MarketVoice,
  StockTermItem,
  VoteOption,
} from "./types";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop";

export default function JuTalkPage() {
  useSession();
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [userVotedIndex, setUserVotedIndex] = useState<number | null>(null);

  const [pollTitle, setPollTitle] = useState("오늘의 투표");
  const [pollQuestion, setPollQuestion] = useState("투표 내용을 불러오는 중입니다.");
  const [pollId, setPollId] = useState<number | null>(null);

  const [expertLikes, setExpertLikes] = useState<Record<number, boolean>>({});
  const [experts, setExperts] = useState<Expert[]>([]);
  const [marketVoices, setMarketVoices] = useState<MarketVoice[]>([]);

  const handleVote = async (index: number) => {
    if (userVotedIndex !== null) return;

    if (pollId == null) {
      // pollId가 없으면 로컬에서만 처리
      setVoteOptions((prev) =>
        prev.map((opt, i) => (i === index ? { ...opt, count: opt.count + 1 } : opt)),
      );
      setUserVotedIndex(index);
      return;
    }

    try {
      const res = await fetch("/api/poll-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll_id: pollId, option_index: index }),
      });
      if (!res.ok) {
        throw new Error("투표 요청 실패");
      }
      const json = await res.json();
      const options = (json?.options as { option_index: number; vote_count: number }[]) ?? [];
      setVoteOptions((prev) =>
        prev.map((opt, idx) => {
          const found = options.find((o) => o.option_index === idx);
          return found ? { ...opt, count: found.vote_count } : opt;
        }),
      );
      setUserVotedIndex(index);
    } catch {
      // 실패 시에도 최소한 로컬에서는 반영
      setVoteOptions((prev) =>
        prev.map((opt, i) => (i === index ? { ...opt, count: opt.count + 1 } : opt)),
      );
      setUserVotedIndex(index);
    }
  };

  const totalVotes = voteOptions.reduce((sum, opt) => sum + opt.count, 0);
  const getPercentage = (count: number) =>
    totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);

  const getVoteButtonClass = (index: number) => {
    const toneIndex = index % 3; // 최대 3가지 색상 톤
    const baseToneClass =
      toneIndex === 0
        ? styles.voteButtonTone0
        : toneIndex === 1
        ? styles.voteButtonTone1
        : styles.voteButtonTone2;
    const activeToneClass =
      toneIndex === 0
        ? styles.voteButtonTone0Active
        : toneIndex === 1
        ? styles.voteButtonTone1Active
        : styles.voteButtonTone2Active;

    if (userVotedIndex === index) {
      return `${styles.voteButton} ${activeToneClass}`;
    }
    if (userVotedIndex === null) {
      return `${styles.voteButton} ${baseToneClass}`;
    }
    return `${styles.voteButton} ${styles.voteButtonDisabled}`;
  };

  const handleExpertLike = (id: number) => {
    setExpertLikes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  useEffect(() => {
    const fetchMarketVoices = async () => {
      try {
        const res = await fetch("/api/market-voices?limit=20", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const items = (json?.data as Array<{ id: number; name: string; title: string; image: string; statement: string; source_url?: string; source_title?: string; time: string }>) ?? [];
        const mapped: MarketVoice[] = items.map((v) => ({
          id: v.id,
          name: v.name,
          title: v.title || "",
          image: v.image || DEFAULT_AVATAR,
          statement: v.statement,
          time: v.time || "",
          source: v.source_title || v.source_url || "",
        }));
        setMarketVoices(mapped);
      } catch {
        // 무시: 시장의 목소리가 없으면 빈 배열
      }
    };
    fetchMarketVoices();
  }, []);

  useEffect(() => {
    const fetchExpertsFromWiki = async () => {
      try {
        const url = `${API_BASE_URL}/api/master-quotes`;
        const response = await fetch(url, {
          method: "GET",
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = await response.json();
        const items = (data?.items as StockTermItem[]) ?? [];
        if (!items.length) return;

        const mapped: Expert[] = items.map((item, index) => {
          return {
            id: item.id ?? index,
            name: item.name,
            title: item.title || "투자 대가",
            image:
              item.image_url ||
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
            quote: item.quote,
            likes: 0,
          };
        });

        setExperts(mapped);
      } catch {
        // 무시: 전문가 명언이 없으면 섹션을 비워둔다.
      }
    };

    const fetchBoardsAndContent = async (): Promise<number | null> => {
      let discoveredPollId: number | null = null;
      try {
        // 투표: 별도 /api/polls/active 사용
        const pollRes = await fetch("/api/polls/active", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (pollRes.ok) {
          const pollJson = await pollRes.json();
          const pollData = pollJson?.data;
          if (pollData?.id && Array.isArray(pollData.options) && pollData.options.length > 0) {
            discoveredPollId = pollData.id;
            setPollId(pollData.id);
            if (pollData.title) setPollTitle(pollData.title);
            setPollQuestion(pollData.description || pollData.title || "투표해 주세요.");
            const parsedOptions: VoteOption[] = pollData.options
              .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
              .map((o: { text: string }, idx: number) => ({
                id: idx,
                label: o.text,
                count: 0,
              }));
            setVoteOptions(parsedOptions);
            setUserVotedIndex(null);
          }
        }

      } catch {
        // ignore and keep defaults
      }
      return discoveredPollId;
    };

    const fetchStatsIfNeeded = async (targetPollId: number | null) => {
      if (!targetPollId) return;
      try {
        const res = await fetch(`/api/poll-stats?poll_id=${targetPollId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const options = (json?.options as { option_index: number; vote_count: number }[]) ?? [];
        if (!options.length) return;
        setVoteOptions((prev) =>
          prev.map((opt, idx) => {
            const found = options.find((o) => o.option_index === idx);
            return found ? { ...opt, count: found.vote_count } : opt;
          }),
        );
      } catch {
        // ignore
      }
    };

    fetchExpertsFromWiki();
    fetchBoardsAndContent().then((id) => fetchStatsIfNeeded(id)).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>

      <main className={styles.main}>
        {/* 오늘의 투표 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <MessageCircle className={styles.sectionIcon} aria-hidden />
              <h2 className={styles.sectionTitle}>오늘의 투표</h2>
            </div>
            <span className={styles.sectionMeta}>
              <Clock className={styles.sectionMetaIcon} aria-hidden />
              {pollTitle}
            </span>
          </div>
          <p className={styles.sectionQuestion}>{pollQuestion}</p>

          {userVotedIndex !== null && (
            <div className={styles.voteResult}>
              <div className={styles.voteMetaRow}>
                <span className={styles.voteTotal}>총 {totalVotes.toLocaleString()}명 참여</span>
              </div>
              <div className={styles.voteOptionResultList}>
                {voteOptions.map((opt) => {
                  const pct = getPercentage(opt.count);
                  return (
                    <div key={opt.id} className={styles.voteOptionRow}>
                      <span className={styles.voteOptionLabel}>{opt.label}</span>
                      <div className={styles.voteOptionBarOuter}>
                        <div
                          className={styles.voteOptionBarInner}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={styles.voteOptionMeta}>
                        {opt.count.toLocaleString()}명 · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.voteButtons}>
            {voteOptions.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleVote(index)}
                disabled={userVotedIndex !== null}
                className={getVoteButtonClass(index)}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 대가들의 한마디 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>대가들의 한마디</h2>
            <p className={styles.sectionSubtitle}>투자 대가들의 명언을 만나보세요</p>
          </div>
          <div className={styles.expertList}>
            {experts.map((expert) => {
              const liked = !!expertLikes[expert.id];
              const likeCount = expert.likes + (liked ? 1 : 0);
              return (
                <article key={expert.id} className={styles.expertCard}>
                  <div className={styles.expertHeader}>
                    <img
                      src={expert.image}
                      alt={expert.name}
                      className={styles.expertAvatar}
                    />
                    <div className={styles.expertInfo}>
                      <h3 className={styles.expertName}>{expert.name}</h3>
                      <p className={styles.expertTitle}>{expert.title}</p>
                    </div>
                  </div>
                  <div className={styles.expertQuoteBox}>
                    <p className={styles.expertQuote}>&quot;{expert.quote}&quot;</p>
                  </div>
                  <div className={styles.expertFooter}>
                    <button
                      type="button"
                      onClick={() => handleExpertLike(expert.id)}
                      className={`${styles.likeButton} ${liked ? styles.likeButtonActive : ""}`}
                    >
                      <Heart
                        aria-hidden
                        className={liked ? styles.likeIconActive : styles.likeIcon}
                      />
                      <span>{likeCount.toLocaleString()}</span>
                    </button>
                    <span className={styles.timeText}>2시간 전</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 시장의 목소리 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>시장의 목소리</h2>
            <p className={styles.sectionSubtitle}>주요 인사들의 최신 발언</p>
          </div>
          <div className={styles.voiceList}>
            {marketVoices.map((voice) => (
              <article key={voice.id} className={styles.voiceCard}>
                <div className={styles.voiceMain}>
                  <img
                    src={voice.image}
                    alt={voice.name}
                    className={styles.voiceAvatar}
                  />
                  <div className={styles.voiceContent}>
                    <div className={styles.voiceHeaderRow}>
                      <div>
                        <h3 className={styles.voiceName}>{voice.name}</h3>
                        <p className={styles.voiceTitle}>{voice.title}</p>
                      </div>
                      <span className={styles.timeText}>{voice.time}</span>
                    </div>
                    <p className={styles.voiceStatement}>&quot;{voice.statement}&quot;</p>
                    <span className={styles.voiceSource}>{voice.source}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 주식 용어 박스 */}
        <section className={styles.section}>
          <StockTermBox />
        </section>
      </main>
    </div>
  );
}