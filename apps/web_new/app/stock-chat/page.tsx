"use client";

import styles from "./JuTalkPage.module.css";
import { Clock, ThumbsUp, MessageCircle, Heart, Send } from "lucide-react";
import { StockTermBox } from "../components/module/stock-term-box";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";
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
const STOCK_CHAT_VOTE_BOARD_ID = "B004";

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

const jubtiIcons: Record<JuBTI, { icon: string; className: string; label: string }> = {
  Bull: { icon: "🐂", className: styles.jubtiBull, label: "불마켓" },
  Bear: { icon: "🐻", className: styles.jubtiBear, label: "베어마켓" },
  Whale: { icon: "🐋", className: styles.jubtiWhale, label: "고래" },
  Rabbit: { icon: "🐰", className: styles.jubtiRabbit, label: "토끼" },
  Fox: { icon: "🦊", className: styles.jubtiFox, label: "여우" },
  Turtle: { icon: "🐢", className: styles.jubtiTurtle, label: "거북이" },
};

const marketVoices: MarketVoice[] = [
  {
    id: 1,
    name: "제롬 파월",
    title: "연준 의장",
    image:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
    statement: "인플레이션을 2% 목표로 되돌리기 위해 필요한 조치를 취할 것",
    time: "2시간 전",
    source: "FOMC 기자회견",
  },
  {
    id: 2,
    name: "재닛 옐런",
    title: "미 재무장관",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
    statement: "미국 경제는 여전히 견고하며 연착륙 가능성이 높다",
    time: "5시간 전",
    source: "G7 재무장관 회의",
  },
  {
    id: 3,
    name: "크리스틴 라가르드",
    title: "ECB 총재",
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
    statement: "유로존 금리는 당분간 현 수준을 유지할 것으로 예상",
    time: "1일 전",
    source: "ECB 통화정책 발표",
  },
];

export default function JuTalkPage() {
  const { data: session } = useSession();
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
  const [expertLikes, setExpertLikes] = useState<Record<number, boolean>>({});
  const [experts, setExperts] = useState<Expert[]>([]);

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

  const handleLike = (id: number) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, likes: msg.isLiked ? msg.likes - 1 : msg.likes + 1, isLiked: !msg.isLiked }
          : msg,
      ),
    );
  };

  const handleExpertLike = (id: number) => {
    setExpertLikes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSendMessage = () => {
    if (!isLoggedIn) {
      alert("로그인 후 이용해 주세요.");
      return;
    }
    const text = newMessage.trim();
    if (!text) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newItem: GuestbookMessage = {
      id: Date.now(),
      user: nickname,
      jubti: "Rabbit",
      content: text,
      time: timeLabel,
      likes: 0,
    };

    setMessages((prev) => [newItem, ...prev]);
    setNewMessage("");
  };

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

    const fetchBoardsAndContent = async () => {
      try {
        const boardsRes = await fetch("/api/boards", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!boardsRes.ok) return;
        const boardsJson = await boardsRes.json();
        const boards = (boardsJson?.data as BoardSummary[]) ?? [];

        const guestbookBoard = boards.find((b) => b.id === STOCK_CHAT_GUESTBOOK_BOARD_ID);
        const voteBoard =
          boards.find((b) => b.type === "poll") ??
          boards.find((b) => b.id === STOCK_CHAT_VOTE_BOARD_ID);

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

        if (voteBoard) {
          const votePostsRes = await fetch(
            `/api/boards/${voteBoard.id}/posts?page=1&limit=1`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            },
          );
          if (votePostsRes.ok) {
            const votePostsJson = await votePostsRes.json();
            const votePosts = (votePostsJson?.data as BoardPostFromApi[]) ?? [];
            if (votePosts.length > 0) {
              const latest = votePosts[0];
              setPollId(latest.id);
              if (latest.title) setPollTitle(latest.title);
              const body = stripHtml(latest.content);
              if (body) {
                const lines = body
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0);

                if (lines.length >= 2) {
                  setPollQuestion(lines[0]);
                  const optionLines = lines.slice(1);
                  const parsedOptions: VoteOption[] = optionLines.map((label, idx) => ({
                    id: idx,
                    label,
                    count: 0,
                  }));
                  if (parsedOptions.length > 0) {
                    setVoteOptions(parsedOptions);
                    setUserVotedIndex(null);
                  }
                } else {
                  setPollQuestion(body);
                }
              }
            }
          }
        }
      } catch {
        // ignore and keep defaults
      }
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
    fetchBoardsAndContent().then(() => fetchStatsIfNeeded(pollId)).catch(() => {});
  }, [pollId]);

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

        {/* 커뮤니티 방명록 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>커뮤니티 방명록</h2>
            <p className={styles.sectionSubtitle}>개미들의 한마디</p>
          </div>
          <div className={styles.writeBox}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isLoggedIn ? "메시지를 입력하세요" : "로그인 후 작성할 수 있습니다"}
              className={styles.writeTextarea}
              rows={3}
            />
            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSendMessage}
              disabled={!isLoggedIn}
            >
              <Send className={styles.sendButtonIcon} aria-hidden />
              <span>작성</span>
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

        {/* 주식 용어 박스 */}
        <section className={styles.section}>
          <StockTermBox />
        </section>
      </main>
    </div>
  );
}