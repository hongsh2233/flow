"use client";

import styles from "./JuTalkPage.module.css";
import { Clock, ThumbsUp, MessageCircle, Heart } from "lucide-react";
import { StockTermBox } from "../components/module/stock-term-box";
import { useEffect, useState } from "react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";

type JuBTI = "Bull" | "Bear" | "Whale" | "Rabbit" | "Fox" | "Turtle";

interface GuestbookMessage {
  id: number;
  user: string;
  jubti: JuBTI;
  content: string;
  time: string;
  likes: number;
  isLiked?: boolean;
}

interface Expert {
  id: number;
  name: string;
  title: string;
  image: string;
  quote: string;
  likes: number;
}

interface MarketVoice {
  id: number;
  name: string;
  title: string;
  image: string;
  statement: string;
  time: string;
  source: string;
}

interface StockTermItem {
  id: number;
  name: string;
  title?: string | null;
  quote: string;
  image_url?: string | null;
}

interface BoardSummary {
  id: string;
  name: string;
  type: string;
}

interface BoardPostFromApi {
  id: number;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

interface VoteOption {
  id: number;
  label: string;
  count: number;
}

const STOCK_CHAT_GUESTBOOK_BOARD_NAME = "주톡 방명록";
const STOCK_CHAT_VOTE_BOARD_NAME = "주톡 투표";

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

const FALLBACK_EXPERTS: Expert[] = [
  {
    id: 1,
    name: "워런 버핏",
    title: "버크셔 해서웨이 회장",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    quote: "가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것입니다.",
    likes: 2847,
  },
  {
    id: 2,
    name: "피터 린치",
    title: "전 마젤란 펀드 매니저",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    quote: "당신이 이해하지 못하는 회사에 투자하지 마세요.",
    likes: 1923,
  },
  {
    id: 3,
    name: "레이 달리오",
    title: "브리지워터 창립자",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
    quote: "다각화는 투자자가 무료로 얻을 수 있는 유일한 점심입니다.",
    likes: 1567,
  },
];

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
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([
    { id: 0, label: "상승할 것 같아요", count: 1847 },
    { id: 1, label: "하락할 것 같아요", count: 1203 },
  ]);
  const [userVotedIndex, setUserVotedIndex] = useState<number | null>(null);

  const [pollTitle, setPollTitle] = useState("오늘 코스피 전망");
  const [pollQuestion, setPollQuestion] = useState("오늘 코스피 마감, 어떻게 예상하시나요?");

  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [expertLikes, setExpertLikes] = useState<Record<number, boolean>>({});
  const [experts, setExperts] = useState<Expert[]>(FALLBACK_EXPERTS);

  const handleVote = (index: number) => {
    if (userVotedIndex !== null) return;
    setVoteOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, count: opt.count + 1 } : opt)),
    );
    setUserVotedIndex(index);
  };

  const totalVotes = voteOptions.reduce((sum, opt) => sum + opt.count, 0);
  const getPercentage = (count: number) =>
    totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);

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
        // ignore and keep fallback
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

        const guestbookBoard = boards.find((b) => b.name === STOCK_CHAT_GUESTBOOK_BOARD_NAME);
        const voteBoard = boards.find((b) => b.name === STOCK_CHAT_VOTE_BOARD_NAME);

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

    fetchExpertsFromWiki();
    fetchBoardsAndContent();
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
                className={`${styles.voteButton} ${
                  userVotedIndex === index
                    ? styles.voteButtonRiseActive
                    : userVotedIndex === null
                    ? styles.voteButtonRise
                    : styles.voteButtonDisabled
                }`}
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
            <p className={styles.sectionSubtitle}>주린이들의 오늘 한마디</p>
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