"use client";

import styles from "./JuTalkPage.module.css";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ThumbsUp,
  MessageCircle,
  Send,
  Heart,
} from "lucide-react";
import { StockTermBox } from "../components/module/stock-term-box";
import { useState } from "react";

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

const jubtiIcons: Record<JuBTI, { icon: string; className: string; label: string }> = {
  Bull: { icon: "🐂", className: styles.jubtiBull, label: "불마켓" },
  Bear: { icon: "🐻", className: styles.jubtiBear, label: "베어마켓" },
  Whale: { icon: "🐋", className: styles.jubtiWhale, label: "고래" },
  Rabbit: { icon: "🐰", className: styles.jubtiRabbit, label: "토끼" },
  Fox: { icon: "🦊", className: styles.jubtiFox, label: "여우" },
  Turtle: { icon: "🐢", className: styles.jubtiTurtle, label: "거북이" },
};

const experts: Expert[] = [
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

const guestbookMessages: GuestbookMessage[] = [
  {
    id: 1,
    user: "주식왕초보",
    jubti: "Rabbit",
    content: "오늘 삼성전자 매수했어요! 장기 투자 시작합니다 🚀",
    time: "2분 전",
    likes: 12,
  },
  {
    id: 2,
    user: "투자고수",
    jubti: "Bull",
    content: "2차전지 업종 지금이 기회인 것 같아요. 다들 화이팅!",
    time: "15분 전",
    likes: 28,
  },
  {
    id: 3,
    user: "배당주러버",
    jubti: "Turtle",
    content: "안정적인 배당주로 포트폴리오 구성 중입니다 ㅎㅎ",
    time: "32분 전",
    likes: 15,
  },
  {
    id: 4,
    user: "분석마스터",
    jubti: "Fox",
    content: "금리 인하 시점이 중요할 것 같습니다. 신중하게!",
    time: "1시간 전",
    likes: 34,
  },
  {
    id: 5,
    user: "대박예감",
    jubti: "Whale",
    content: "미국 빅테크 추가 매수 완료! 장투 가즈아 💪",
    time: "2시간 전",
    likes: 52,
  },
  {
    id: 6,
    user: "신중파",
    jubti: "Bear",
    content: "지금은 조금 관망하는 게 좋을 것 같아요...",
    time: "3시간 전",
    likes: 19,
  },
];

export default function JuTalkPage() {
  const [vote, setVote] = useState<{ rise: number; fall: number; userVoted: "rise" | "fall" | null }>({
    rise: 1847,
    fall: 1203,
    userVoted: null,
  });

  const [messages, setMessages] = useState(guestbookMessages);
  const [newMessage, setNewMessage] = useState("");
  const [expertLikes, setExpertLikes] = useState<Record<number, boolean>>({});

  const handleVote = (choice: "rise" | "fall") => {
    if (vote.userVoted === null) {
      setVote({
        ...vote,
        [choice]: vote[choice] + 1,
        userVoted: choice,
      });
    }
  };

  const totalVotes = vote.rise + vote.fall;
  const risePercentage = Math.round((vote.rise / totalVotes) * 100);
  const fallPercentage = Math.round((vote.fall / totalVotes) * 100);

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

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const newMsg: GuestbookMessage = {
      id: messages.length + 1,
      user: "주린이님",
      jubti: "Rabbit",
      content: newMessage,
      time: "방금",
      likes: 0,
    };
    setMessages((prev) => [newMsg, ...prev]);
    setNewMessage("");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerGradient} />
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>주톡</h1>
          <p className={styles.headerSubtitle}>투자자들의 실시간 소통 공간</p>
        </div>
      </header>

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
              오늘 코스피 전망
            </span>
          </div>
          <p className={styles.sectionQuestion}>오늘 코스피 마감, 어떻게 예상하시나요?</p>

          {vote.userVoted && (
            <div className={styles.voteResult}>
              <div className={styles.voteBar}>
                <div
                  className={styles.voteRise}
                  style={{ width: `${risePercentage}%` }}
                >
                  {risePercentage > 20 && (
                    <span className={styles.voteLabel}>상승 {risePercentage}%</span>
                  )}
                </div>
                <div
                  className={styles.voteFall}
                  style={{ width: `${fallPercentage}%` }}
                >
                  {fallPercentage > 20 && (
                    <span className={styles.voteLabel}>하락 {fallPercentage}%</span>
                  )}
                </div>
              </div>
              <div className={styles.voteMetaRow}>
                <span>{vote.rise.toLocaleString()}명</span>
                <span className={styles.voteTotal}>총 {totalVotes.toLocaleString()}명 참여</span>
                <span>{vote.fall.toLocaleString()}명</span>
              </div>
            </div>
          )}

          <div className={styles.voteButtons}>
            <button
              type="button"
              onClick={() => handleVote("rise")}
              disabled={vote.userVoted !== null}
              className={`${styles.voteButton} ${
                vote.userVoted === "rise"
                  ? styles.voteButtonRiseActive
                  : vote.userVoted === null
                  ? styles.voteButtonRise
                  : styles.voteButtonDisabled
              }`}
            >
              <TrendingUp aria-hidden />
              <span>상승할 것 같아요</span>
            </button>
            <button
              type="button"
              onClick={() => handleVote("fall")}
              disabled={vote.userVoted !== null}
              className={`${styles.voteButton} ${
                vote.userVoted === "fall"
                  ? styles.voteButtonFallActive
                  : vote.userVoted === null
                  ? styles.voteButtonFall
                  : styles.voteButtonDisabled
              }`}
            >
              <TrendingDown aria-hidden />
              <span>하락할 것 같아요</span>
            </button>
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

          <div className={styles.writeBox}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="오늘의 한마디를 남겨보세요..."
              className={styles.writeInput}
            />
            <button
              type="button"
              onClick={handleSend}
              className={styles.sendButton}
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

        {/* 주식 용어 박스 */}
        <section className={styles.section}>
          <StockTermBox />
        </section>
      </main>
    </div>
  );
}