"use client";

import styles from "./JuTalkPage.module.css";

export default function JuTalkPage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.placeholder}>
        <p className={styles.message}>
          주톡 서비스 준비 중입니다.
          <br />
          커뮤니티가 곧 찾아옵니다!
        </p>
      </div>
    </div>
  );
}
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Clock, 
  ThumbsUp, 
  MessageCircle,
  Send,
  Heart
} from "lucide-react";
import { StockTermBox } from "../stock-term-box";
import { useState } from "react";

// 주BTI 성향 타입
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

// 주BTI 아이콘 매핑
const jubtiIcons: Record<JuBTI, { icon: string; color: string; label: string }> = {
  Bull: { icon: "🐂", color: "bg-red-100 text-red-600", label: "불마켓" },
  Bear: { icon: "🐻", color: "bg-blue-100 text-blue-600", label: "베어마켓" },
  Whale: { icon: "🐋", color: "bg-purple-100 text-purple-600", label: "고래" },
  Rabbit: { icon: "🐰", color: "bg-pink-100 text-pink-600", label: "토끼" },
  Fox: { icon: "🦊", color: "bg-orange-100 text-orange-600", label: "여우" },
  Turtle: { icon: "🐢", color: "bg-green-100 text-green-600", label: "거북이" },
};

// 대가들의 한마디
const experts: Expert[] = [
  {
    id: 1,
    name: "워런 버핏",
    title: "버크셔 해서웨이 회장",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    quote: "가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것입니다.",
    likes: 2847,
  },
  {
    id: 2,
    name: "피터 린치",
    title: "전 마젤란 펀드 매니저",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    quote: "당신이 이해하지 못하는 회사에 투자하지 마세요.",
    likes: 1923,
  },
  {
    id: 3,
    name: "레이 달리오",
    title: "브리지워터 창립자",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
    quote: "다각화는 투자자가 무료로 얻을 수 있는 유일한 점심입니다.",
    likes: 1567,
  },
];

// 전문가별 배경 색상 매핑
const expertColors: Record<number, string> = {
  1: "from-orange-50 to-pink-50",
  2: "from-blue-50 to-purple-50",
  3: "from-emerald-50 to-teal-50",
};

// 시장의 목소리
const marketVoices: MarketVoice[] = [
  {
    id: 1,
    name: "제롬 파월",
    title: "연준 의장",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
    statement: "인플레이션을 2% 목표로 되돌리기 위해 필요한 조치를 취할 것",
    time: "2시간 전",
    source: "FOMC 기자회견",
  },
  {
    id: 2,
    name: "재닛 옐런",
    title: "미 재무장관",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
    statement: "미국 경제는 여전히 견고하며 연착륙 가능성이 높다",
    time: "5시간 전",
    source: "G7 재무장관 회의",
  },
  {
    id: 3,
    name: "크리스틴 라가르드",
    title: "ECB 총재",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
    statement: "유로존 금리는 당분간 현 수준을 유지할 것으로 예상",
    time: "1일 전",
    source: "ECB 통화정책 발표",
  },
];

// 방명록 메시지
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

export function JutalkScreen() {
  const [vote, setVote] = useState<{ rise: number; fall: number; userVoted: 'rise' | 'fall' | null }>({
    rise: 1847,
    fall: 1203,
    userVoted: null,
  });

  const [messages, setMessages] = useState(guestbookMessages);
  const [newMessage, setNewMessage] = useState("");
  const [expertLikes, setExpertLikes] = useState<Record<number, boolean>>({});

  const handleVote = (choice: 'rise' | 'fall') => {
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
    setMessages(
      messages.map((msg) =>
        msg.id === id
          ? { ...msg, likes: msg.isLiked ? msg.likes - 1 : msg.likes + 1, isLiked: !msg.isLiked }
          : msg
      )
    );
  };

  const handleExpertLike = (id: number) => {
    setExpertLikes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSend = () => {
    if (newMessage.trim()) {
      const newMsg: GuestbookMessage = {
        id: messages.length + 1,
        user: "주린이님",
        jubti: "Rabbit",
        content: newMessage,
        time: "방금",
        likes: 0,
      };
      setMessages([newMsg, ...messages]);
      setNewMessage("");
    }
  };

  return (
    <div className="pb-20 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-1">주톡 💬</h2>
        <p className="text-orange-50 text-sm">투자자들의 실시간 소통 공간</p>
      </div>

      {/* 오늘의 투표 */}
      <div className="px-4 mb-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-base text-gray-800">오늘의 투표</h3>
          </div>
          
          <p className="text-sm text-gray-700 mb-4 font-medium">
            📊 오늘 코스피 마감 어떻게 예상하시나요?
          </p>

          {/* 투표 결과 */}
          {vote.userVoted && (
            <div className="mb-4">
              <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700 flex items-center justify-start pl-4"
                  style={{ width: `${risePercentage}%` }}
                >
                  {risePercentage > 20 && (
                    <span className="text-sm font-bold text-white">상승 {risePercentage}%</span>
                  )}
                </div>
                <div
                  className="absolute right-0 top-0 h-full bg-gradient-to-l from-blue-400 to-blue-500 transition-all duration-700 flex items-center justify-end pr-4"
                  style={{ width: `${fallPercentage}%` }}
                >
                  {fallPercentage > 20 && (
                    <span className="text-sm font-bold text-white">하락 {fallPercentage}%</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{vote.rise.toLocaleString()}명</span>
                <span className="font-medium text-gray-700">총 {totalVotes.toLocaleString()}명 참여</span>
                <span>{vote.fall.toLocaleString()}명</span>
              </div>
            </div>
          )}

          {/* 투표 버튼 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleVote('rise')}
              disabled={vote.userVoted !== null}
              className={`py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                vote.userVoted === 'rise'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg scale-105'
                  : vote.userVoted === null
                  ? 'bg-gradient-to-r from-red-400 to-red-500 text-white hover:shadow-lg hover:scale-105'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              상승할 것 같아요
            </button>
            <button
              onClick={() => handleVote('fall')}
              disabled={vote.userVoted !== null}
              className={`py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                vote.userVoted === 'fall'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                  : vote.userVoted === null
                  ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white hover:shadow-lg hover:scale-105'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <TrendingDown className="w-5 h-5" />
              하락할 것 같아요
            </button>
          </div>
        </div>
      </div>

      {/* 대가들의 한마디 - 인스타그램 피드 스타일 */}
      <div className="px-4 mb-5">
        <div className="mb-3">
          <h3 className="font-bold text-base text-gray-800">💡 대가들의 한마디</h3>
          <p className="text-xs text-gray-500 mt-0.5">투자 대가들의 명언을 만나보세요</p>
        </div>
        
        <div className="space-y-3">
          {experts.map((expert) => (
            <div
              key={expert.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
            >
              {/* 프로필 헤더 */}
              <div className="p-3 flex items-center gap-2 border-b border-gray-100">
                <img
                  src={expert.image}
                  alt={expert.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-orange-200"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-800 truncate">{expert.name}</h4>
                  <p className="text-xs text-gray-500 truncate">{expert.title}</p>
                </div>
              </div>

              {/* 명언 카드 */}
              <div className={`p-4 bg-gradient-to-br ${expertColors[expert.id]} min-h-[100px] flex items-center justify-center`}>
                <p className="text-sm text-gray-700 leading-relaxed text-center font-medium">
                  "{expert.quote}"
                </p>
              </div>

              {/* 좋아요 */}
              <div className="p-3 flex items-center justify-between">
                <button
                  onClick={() => handleExpertLike(expert.id)}
                  className={`flex items-center gap-1.5 transition-all ${
                    expertLikes[expert.id] ? 'text-red-500' : 'text-gray-400'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${expertLikes[expert.id] ? 'fill-current' : ''}`}
                  />
                  <span className="text-sm font-medium">
                    {(expert.likes + (expertLikes[expert.id] ? 1 : 0)).toLocaleString()}
                  </span>
                </button>
                <span className="text-xs text-gray-400">2시간 전</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 시장의 목소리 */}
      <div className="px-4 mb-5">
        <div className="mb-3">
          <h3 className="font-bold text-base text-gray-800">🎤 시장의 목소리</h3>
          <p className="text-xs text-gray-500 mt-0.5">주요 인사들의 최신 발언</p>
        </div>

        <div className="space-y-3">
          {marketVoices.map((voice) => (
            <div
              key={voice.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-3">
                <img
                  src={voice.image}
                  alt={voice.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-gray-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">{voice.name}</h4>
                      <p className="text-xs text-gray-500">{voice.title}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{voice.time}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">
                    "{voice.statement}"
                  </p>
                  <div className="inline-block bg-blue-50 px-2 py-1 rounded-lg">
                    <span className="text-xs text-blue-600 font-medium">{voice.source}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 커뮤니티 방명록 */}
      <div className="px-4 mb-5">
        <div className="mb-3">
          <h3 className="font-bold text-base text-gray-800">📝 커뮤니티 방명록</h3>
          <p className="text-xs text-gray-500 mt-0.5">주린이들의 오늘 한마디</p>
        </div>

        {/* 글쓰기 */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="오늘의 한마디를 남겨보세요..."
              className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button
              onClick={handleSend}
              className="bg-gradient-to-r from-orange-400 to-pink-400 text-white px-4 rounded-xl hover:shadow-md transition-all flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 방명록 메시지 */}
        <div className="space-y-2">
          {messages.map((message) => {
            const jubtiInfo = jubtiIcons[message.jubti];
            return (
              <div
                key={message.id}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-sm text-gray-800">{message.user}</span>
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${jubtiInfo.color}`}
                        title={jubtiInfo.label}
                      >
                        <span>{jubtiInfo.icon}</span>
                        <span>{jubtiInfo.label}</span>
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{message.time}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-2">
                      {message.content}
                    </p>
                    <button
                      onClick={() => handleLike(message.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs ${
                        message.isLiked
                          ? 'bg-orange-50 text-orange-500'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${message.isLiked ? 'fill-current' : ''}`} />
                      <span className="font-medium">{message.likes}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 주식 용어 박스 */}
      <div className="px-4 mb-6">
        <StockTermBox />
      </div>
    </div>
  );
}