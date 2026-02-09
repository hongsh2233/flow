import { Clock, TrendingUp } from "lucide-react";
import { StockTermBox } from "../stock-term-box";

const newsItems = [
  {
    id: 1,
    category: "경제",
    title: "삼성전자, 신규 반도체 공장 건설 발표",
    summary: "삼성전자가 차세대 반도체 생산을 위한 신규 공장 건설을 발표했습니다.",
    time: "10분 전",
    tag: "핫이슈",
  },
  {
    id: 2,
    category: "시장",
    title: "코스피, 외국인 순매수에 상승 마감",
    summary: "코스피 지수가 외국인 투자자들의 순매수에 힘입어 상승 마감했습니다.",
    time: "30분 전",
    tag: null,
  },
  {
    id: 3,
    category: "기업",
    title: "네이버, AI 신기술 개발 성공",
    summary: "네이버가 새로운 인공지능 기술 개발에 성공하며 주가가 급등했습니다.",
    time: "1시간 전",
    tag: "주목",
  },
  {
    id: 4,
    category: "글로벌",
    title: "미국 증시, 빅테크 강세로 상승",
    summary: "미국 증시가 빅테크 기업들의 강세로 상승 마감했습니다.",
    time: "2시간 전",
    tag: null,
  },
  {
    id: 5,
    category: "증권",
    title: "하반기 유망 업종 전망",
    summary: "증권가에서 하반기 유망 업종으로 2차전지와 바이오를 꼽았습니다.",
    time: "3시간 전",
    tag: "분석",
  },
];

export function NewsScreen() {
  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-1">주식 뉴스 📰</h2>
        <p className="text-orange-50 text-sm">실시간으로 업데이트되는 주요 뉴스</p>
      </div>

      {/* 카테고리 필터 */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["전체", "경제", "시장", "기업", "글로벌"].map((category) => (
            <button
              key={category}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === "전체"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* 뉴스 리스트 */}
      <div className="px-4 space-y-3">
        {newsItems.map((news) => (
          <div
            key={news.id}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
                    {news.category}
                  </span>
                  {news.tag && (
                    <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">
                      {news.tag}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base mb-2 leading-snug">
                  {news.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  {news.summary}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{news.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 더보기 버튼 */}
      <div className="px-4 mt-4">
        <button className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium hover:bg-gray-200 transition-colors">
          더 많은 뉴스 보기
        </button>
      </div>

      {/* 주식 용어 박스 */}
      <div className="px-4 mt-6">
        <StockTermBox />
      </div>
    </div>
  );
}