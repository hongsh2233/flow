"use client";

import styles from "./JuTalkPage.module.css";
import { Clock, MessageCircle, Heart, Send, ThumbsUp, User } from "lucide-react";
import { StockTermBox } from "../components/module/stock-term-box";
import { RandomAffiliateCard } from "../components/module/affiliate/RandomAffiliateCard";
import { AdZoneSlot } from "../components/module/AdZoneSlot";
import { shouldShowAdZoneB_vip } from "@/lib/affiliate/adZoneB";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAuthHeaders } from "@/lib/config/api";
import { pickMultipleWeightedByMaster, pickWeightedByMaster } from "@/lib/jubti/jubtiMasters";
import { useJubtiMasterName } from "@/lib/hooks/useJubtiMasterName";
import type {
  JuBTI,
  GuestbookMessage,
  Expert,
  MarketVoice,
  StockTermItem,
  BoardSummary,
  BoardPostFromApi,
  VoteOption,
} from "./types";

const STOCK_CHAT_GUESTBOOK_BOARD_ID = "B005";

/** 주톡: 시장의 목소리·투자은행 연동 UI 비활성화 */
const ENABLE_MARKET_VOICES_SECTION = false;

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function ExpertAvatar({ imageUrl, name }: { imageUrl: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl?.trim() ?? "";
  const usePlaceholder = !url || failed;

  if (usePlaceholder) {
    return (
      <div
        className={styles.expertAvatarPlaceholder}
        aria-label={`${name} 프로필 (미등록)`}
        role="img"
      >
        <User className={styles.expertAvatarPlaceholderIcon} strokeWidth={1.75} aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`${name} 프로필`}
      className={styles.expertAvatar}
      onError={() => setFailed(true)}
    />
  );
}

const jubtiIcons: Record<JuBTI, { icon: string; className: string; label: string }> = {
  Bull: { icon: "🐂", className: styles.jubtiBull, label: "불마켓" },
  Bear: { icon: "🐻", className: styles.jubtiBear, label: "베어마켓" },
  Whale: { icon: "🐋", className: styles.jubtiWhale, label: "고래" },
  Rabbit: { icon: "🐰", className: styles.jubtiRabbit, label: "토끼" },
  Fox: { icon: "🦊", className: styles.jubtiFox, label: "여우" },
  Turtle: { icon: "🐢", className: styles.jubtiTurtle, label: "거북이" },
};

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop";

const SOURCE_INITIALS: Record<string, string> = {
  GS: "GS", MS: "MS", JPM: "JPM", Citi: "CT",
  BofA: "BA", Barclays: "BC", UBS: "UBS",
  Jefferies: "JF", BlackRock: "BR", Vanguard: "VG", Fidelity: "FD",
};
const SOURCE_COLORS: Record<string, string> = {
  GS: "#003594", MS: "#003DA5", JPM: "#005EB8",
  Citi: "#003B70", BofA: "#E31837", Barclays: "#00AEEF",
  UBS: "#E60000", Jefferies: "#6A1B9A", BlackRock: "#2C3E50",
  Vanguard: "#8B0000", Fidelity: "#49A84C",
};

export default function JuTalkPage() {
  const { data: session, status } = useSession();
  const jubtiMasterName = useJubtiMasterName();
  const isLoggedIn = !!session?.user;
  const nickname =
    (session?.user as { nickname?: string | null; name?: string | null })?.nickname ||
    session?.user?.name ||
    "회원";
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [userVotedIndex, setUserVotedIndex] = useState<number | null>(null);

  const [pollTitle, setPollTitle] = useState("오늘의 투표");
  const [pollQuestion, setPollQuestion] = useState("투표 내용을 불러오는 중입니다.");
  const [pollId, setPollId] = useState<number | null>(null);

  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [latestPosts, setLatestPosts] = useState<BoardPostFromApi[]>([]);
  const [studyNoteBoardId, setStudyNoteBoardId] = useState<string | null>(null);

  const getGuestId = (): string => {
    if (typeof window === "undefined") return "";
    let g = localStorage.getItem("ju_guest_id");
    if (!g) {
      g = "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ju_guest_id", g);
    }
    return g;
  };
  const [experts, setExperts] = useState<Expert[]>([]);
  const [displayedExperts, setDisplayedExperts] = useState<Expert[]>([]);
  const [marketVoices, setMarketVoices] = useState<MarketVoice[]>([]);
  const [displayedVoices, setDisplayedVoices] = useState<MarketVoice[]>([]);

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
      const voterKey = getGuestId(); // 1인 1표: guest_id로 중복 방지
      const res = await fetch("/api/poll-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll_id: pollId, option_index: index, voter_key: voterKey }),
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
      // already_voted면 기존 투표 옵션 표시, 아니면 방금 선택한 index
      const votedIdx = json?.already_voted ? json?.user_voted_option_index : index;
      setUserVotedIndex(typeof votedIdx === "number" ? votedIdx : index);
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

  const handleExpertLike = async (expert: Expert) => {
    const email = (session?.user as { email?: string })?.email;
    const guestId = !email ? getGuestId() : undefined;
    if (!email && !guestId) return;

    try {
      const res = await fetch(`/api/master-quotes/${expert.id}/like`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: email || undefined, guest_id: guestId }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        const next = (e: Expert) =>
          e.id === expert.id
            ? { ...e, likes: json.like_count ?? e.likes, is_liked: json.liked }
            : e;
        setExperts((prev) => prev.map(next));
        setDisplayedExperts((prev) => prev.map(next));
      }
    } catch {
      // ignore
    }
  };

  const handleLike = (id: number) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, likes: msg.isLiked ? msg.likes - 1 : msg.likes + 1, isLiked: !msg.isLiked }
          : msg,
      ),
    );
  };

  const handleSendMessage = async () => {
    if (!isLoggedIn) {
      alert("로그인 후 이용해 주세요.");
      return;
    }
    const text = newMessage.trim();
    if (!text) return;
    if (isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/boards/${STOCK_CHAT_GUESTBOOK_BOARD_ID}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json();

      if (!res.ok) {
        alert(json.message || "작성에 실패했습니다.");
        return;
      }

      const created = json?.data;
      const timeLabel = created?.created_at
        ? new Date(created.created_at).toLocaleDateString("ko-KR", {
            month: "2-digit",
            day: "2-digit",
          })
        : new Date().toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

      const newItem: GuestbookMessage = {
        id: created?.id ?? Date.now(),
        user: created?.author ?? nickname,
        jubti: "Rabbit",
        content: text,
        time: timeLabel,
        likes: 0,
      };

      setMessages((prev) => [newItem, ...prev]);
      setNewMessage("");
    } catch {
      alert("작성에 실패했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!ENABLE_MARKET_VOICES_SECTION) return;
    const fetchMarketVoices = async () => {
      try {
        const res = await fetch("/api/market-voices?limit=30", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const items = (json?.data as Array<{ id: number; name: string; title: string; image: string; sourceCode?: string; statement: string; source_url?: string; source_title?: string; time: string }>) ?? [];
        const mapped: MarketVoice[] = items.map((v) => ({
          id: v.id,
          name: v.name,
          title: v.title || "",
          image: v.image || DEFAULT_AVATAR,
          sourceCode: v.sourceCode,
          statement: v.statement,
          time: v.time || "",
          source: v.source_title || v.source_url || "",
          sourceUrl: v.source_url || "",
        }));
        setMarketVoices(mapped);
        // 초기 6개 랜덤 선택
        const shuffled = [...mapped].sort(() => Math.random() - 0.5);
        setDisplayedVoices(shuffled.slice(0, Math.min(6, shuffled.length)));
      } catch {
        // 무시: 시장의 목소리가 없으면 빈 배열
      }
    };
    fetchMarketVoices();
    const interval = setInterval(fetchMarketVoices, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchExpertsFromWiki = async () => {
      try {
        const email = (session?.user as { email?: string })?.email;
        const guestId = !email ? getGuestId() : undefined;
        const params = new URLSearchParams();
        if (email) params.set("email", email);
        else if (guestId) params.set("guest_id", guestId);
        const qs = params.toString();
        const url = `/api/master-quotes${qs ? `?${qs}` : ""}`;
        const response = await fetch(url, {
          method: "GET",
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = await response.json();
        const items = (data?.items as Array<StockTermItem & { likes?: number; is_liked?: boolean }>) ?? [];
        if (!items.length) return;

        const mapped: Expert[] = items.map((item, index) => ({
          id: item.id ?? index,
          name: item.name,
          title: item.title || "투자 대가",
          image: item.image_url?.trim() ? item.image_url.trim() : "",
          quote: item.quote,
          likes: item.likes ?? 0,
          is_liked: item.is_liked ?? false,
        }));

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

        const boardsRes = await fetch("/api/boards", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!boardsRes.ok) return discoveredPollId;
        const boardsJson = await boardsRes.json();
        const boards = (boardsJson?.data as BoardSummary[]) ?? [];
        const studyNoteBoard = boards.find((b) => b.name?.includes("공부노트"));
        const guestbookBoard = boards.find((b) => b.id === STOCK_CHAT_GUESTBOOK_BOARD_ID);

        if (studyNoteBoard) {
          setStudyNoteBoardId(studyNoteBoard.id);
          const latestRes = await fetch(
            `/api/boards/${studyNoteBoard.id}/posts?page=1&limit=3`,
            { method: "GET", headers: { "Content-Type": "application/json" }, cache: "no-store" },
          );
          if (latestRes.ok) {
            const latestJson = await latestRes.json();
            setLatestPosts((latestJson?.data as BoardPostFromApi[]) ?? []);
          }
        } else {
          setStudyNoteBoardId(null);
          setLatestPosts([]);
        }

        if (guestbookBoard) {
          const postsRes = await fetch(
            `/api/boards/${guestbookBoard.id}/posts?page=1&limit=20`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            },
          );
          if (postsRes.ok) {
            const postsJson = await postsRes.json();
            const posts = (postsJson?.data as BoardPostFromApi[]) ?? [];
            const mappedMessages: GuestbookMessage[] = posts.map((post) => ({
              id: post.id,
              user: post.author || "운영자",
              jubti: "Rabbit",
              content: stripHtml(post.content),
              time: new Date(post.created_at).toLocaleDateString("ko-KR", {
                month: "2-digit",
                day: "2-digit",
              }),
              likes: 0,
            }));
            setMessages(mappedMessages);
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
        const voterKey = getGuestId();
        const res = await fetch(`/api/poll-stats?poll_id=${targetPollId}&voter_key=${encodeURIComponent(voterKey)}`, {
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
        const votedIdx = json?.user_voted_option_index as number | undefined;
        if (typeof votedIdx === "number" && votedIdx >= 0) setUserVotedIndex(votedIdx);
      } catch {
        // ignore
      }
    };

    fetchExpertsFromWiki();
    fetchBoardsAndContent().then((id) => fetchStatsIfNeeded(id)).catch(() => {});
  }, [session?.user]);

  /* 주BTI 대가 약 70% · 기타 약 30% 비율로 초기 3명 노출 */
  useEffect(() => {
    if (experts.length === 0) {
      setDisplayedExperts([]);
      return;
    }
    setDisplayedExperts(
      pickMultipleWeightedByMaster(experts, jubtiMasterName, 3, (e) => String(e.id)),
    );
  }, [experts, jubtiMasterName]);

  /* 대가들의 한마디: 10초마다 새 1개 추가 (SNS 스타일, 7:3 가중) */
  useEffect(() => {
    if (experts.length < 2) return;
    const interval = setInterval(() => {
      setDisplayedExperts((prev) => {
        const pool = experts.filter((e) => !prev.some((p) => p.id === e.id));
        const source = pool.length > 0 ? pool : experts;
        const head = prev[0] ?? null;
        const next = pickWeightedByMaster(source, head, jubtiMasterName, (e) => String(e.id));
        return [next, ...prev].slice(0, 3);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [experts, jubtiMasterName]);

  /* 시장의 목소리: 10초마다 새 1개 추가 (SNS 실시간 스타일, 최대 6개) */
  useEffect(() => {
    if (!ENABLE_MARKET_VOICES_SECTION) return;
    if (marketVoices.length < 2) return;
    const interval = setInterval(() => {
      setDisplayedVoices((prev) => {
        const pool = marketVoices.filter((v) => !prev.some((p) => p.id === v.id));
        const next =
          pool.length > 0
            ? pool[Math.floor(Math.random() * pool.length)]
            : prev[5] ?? prev[0]; // 모두 표시됐으면 맨 뒤 것을 맨 앞으로
        return [next, ...prev].slice(0, 6);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [marketVoices]);

  return (
    <div className={styles.page}>

      <main className={styles.main}>
        {/* 오늘의 투표 - 등록된 투표가 있을 때만 노출 */}
        {voteOptions.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <MessageCircle className={styles.sectionIcon} aria-hidden />
              <h2 className={styles.sectionTitle}>오늘의 투표</h2>
            </div>
          </div>
          <span className={styles.sectionMeta}>
            <Clock className={styles.sectionMetaIcon} aria-hidden />
            {pollTitle}
          </span>
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
        )}

        {/* 공부노트 최신글 3개 */}
        {latestPosts.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={`${styles.sectionTitle} ${styles.studyNoteTitle}`}>공부노트</h2>
            </div>
            <ul className={styles.latestPostList}>
              {latestPosts.map((post) => (
                <li key={post.id} className={styles.latestPostItem}>
                  <a href={`/board/${post.id}${studyNoteBoardId ? `?from=${studyNoteBoardId}` : ""}`} className={styles.latestPostLink}>
                    <span className={styles.latestPostContent}>{stripHtml(post.title || post.content || "")}</span>
                    <span className={styles.latestPostTime}>
                      {post.created_at
                        ? new Date(post.created_at).toLocaleDateString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* [AD_ZONE B7 — 공부노트와 시장의 목소리 사이 / VIP회원까지] */}
        {shouldShowAdZoneB_vip(session, status) && <AdZoneSlot zone="B7" />}

        {/* 시장의 목소리 - 비활성화 (ENABLE_MARKET_VOICES_SECTION) */}
        {ENABLE_MARKET_VOICES_SECTION && displayedVoices.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>시장의 목소리</h2>
            <p className={styles.sectionSubtitle}>주요 인사들의 최신 발언</p>
          </div>
          <div className={styles.voiceList}>
            {displayedVoices.map((voice, idx) => (
              <article key={voice.id} className={`${styles.voiceCard} ${idx === 0 ? styles.voiceCardNew : ""}`}>
                <div className={styles.voiceMain}>
                  {voice.sourceCode ? (
                    <div
                      className={styles.voiceInitials}
                      style={{ background: SOURCE_COLORS[voice.sourceCode] ?? "#6B7280" }}
                    >
                      {SOURCE_INITIALS[voice.sourceCode] ?? voice.sourceCode.slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <img
                      src={voice.image}
                      alt={voice.name}
                      className={styles.voiceAvatar}
                    />
                  )}
                  <div className={styles.voiceContent}>
                    <div className={styles.voiceHeaderRow}>
                      <div>
                        <h3 className={styles.voiceName}>{voice.name}</h3>
                        <p className={styles.voiceTitle}>{voice.title}</p>
                      </div>
                      <span className={styles.timeText}>{voice.time}</span>
                    </div>
                    <p className={styles.voiceStatement}>&quot;{voice.statement}&quot;</p>
                    {voice.source && (
                      voice.sourceUrl ? (
                        <a
                          href={voice.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.voiceSource}
                        >
                          {voice.source}
                        </a>
                      ) : (
                        <span className={styles.voiceSource}>{voice.source}</span>
                      )
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}

        <div className={styles.affiliateSlot} aria-label="제휴 상품">
          <RandomAffiliateCard />
        </div>

        {/* 대가들의 한마디 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>대가들의 한마디</h2>
            <p className={styles.sectionSubtitle}>투자 대가들의 명언을 만나보세요</p>
          </div>
          <div className={styles.expertList}>
            {displayedExperts.map((expert, idx) => {
              const liked = !!expert.is_liked;
              return (
                <article
                  key={expert.id}
                  className={`${styles.expertCard} ${idx === 0 ? styles.expertCardNew : ""}`}
                >
                  <div className={styles.expertHeader}>
                    <ExpertAvatar imageUrl={expert.image} name={expert.name} />
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
                      onClick={() => handleExpertLike(expert)}
                      className={`${styles.likeButton} ${liked ? styles.likeButtonActive : ""}`}
                    >
                      <Heart
                        aria-hidden
                        className={liked ? styles.likeIconActive : styles.likeIcon}
                      />
                      <span>{expert.likes.toLocaleString()}</span>
                    </button>
                    <span className={styles.timeText}>2시간 전</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 시장의 목소리 방명록 (B005 게시판) — 주석처리
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>시장의 목소리 방명록</h2>
            <p className={styles.sectionSubtitle}>개미들의 한마디</p>
          </div>
          <div className={styles.writeBox}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요"
              className={styles.writeTextarea}
              rows={3}
            />
            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSendMessage}
              disabled={!isLoggedIn || isSending}
            >
              <Send aria-hidden />
            </button>
          </div>
          <div className={styles.messageList}>
            {messages.map((message) => {
              const jubtiInfo = jubtiIcons[message.jubti];
              return (
                <article key={message.id} className={styles.messageCard}>
                  <div className={styles.messageHeader}>
                    <span className={styles.messageUser}>{message.user}</span>
                    <span
                      className={`${styles.jubtiBadge} ${jubtiInfo.className}`}
                      title={jubtiInfo.label}
                    >
                      <span>{jubtiInfo.icon}</span>
                      <span>{jubtiInfo.label}</span>
                    </span>
                    <span className={styles.timeText}>{message.time}</span>
                  </div>
                  <p className={styles.messageBody}>{message.content}</p>
                  <button
                    type="button"
                    onClick={() => handleLike(message.id)}
                    className={`${styles.messageLikeButton} ${
                      message.isLiked ? styles.messageLikeButtonActive : ""
                    }`}
                  >
                    <ThumbsUp
                      aria-hidden
                      className={
                        message.isLiked ? styles.messageLikeIconActive : styles.messageLikeIcon
                      }
                    />
                    <span>{message.likes}</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
        */}

        {/* 주식 용어 박스 */}
        <section className={styles.section}>
          <StockTermBox />
        </section>
      </main>
    </div>
  );
}