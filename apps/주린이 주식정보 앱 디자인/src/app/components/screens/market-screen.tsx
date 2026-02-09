import { FileText, TrendingUp, Clock, Eye, MessageCircle } from "lucide-react";
import { StockTermBox } from "../stock-term-box";

const reportPosts = [
  {
    id: 1,
    category: "마감시황",
    title: "코스피, 외국인 매수세에 1% 상승 마감",
    summary: "코스피가 외국인 투자자들의 순매수에 힘입어 1% 상승하며 2,456선에서 거래를 마쳤습니다. IT와 자동차 업종이 강세를 보였습니다.",
    author: "시황팀",
    time: "30분 전",
    views: 1234,
    comments: 45,
    tag: "HOT",
  },
  {
    id: 2,
    category: "마감시황",
    title: "코스닥, 개인 매도세에 소폭 하락",
    summary: "코스닥은 개인 투자자들의 매도 물량이 나오며 0.5% 하락했습니다. 바이오와 IT 중소형주 위주로 약세를 보였습니다.",
    author: "시황팀",
    time: "1시간 전",
    views: 892,
    comments: 23,
    tag: null,
  },
  {
    id: 3,
    category: "상한가 분석",
    title: "삼성전자, 실적 호조에 상한가 근접",
    summary: "삼성전자가 4분기 실적 호조 전망에 힘입어 장중 상한가에 근접했습니다. 반도체 업황 개선 기대감이 반영된 것으로 보입니다.",
    author: "종목분석팀",
    time: "2시간 전",
    views: 2156,
    comments: 78,
    tag: "분석",
  },
  {
    id: 4,
    category: "상한가 분석",
    title: "에코프로 상한가, 2차전지 수혜주 강세",
    summary: "에코프로가 전기차 배터리 수요 증가 소식에 상한가를 기록했습니다. 2차전지 관련주들이 일제히 강세를 보이고 있습니다.",
    author: "종목분석팀",
    time: "3시간 전",
    views: 1876,
    comments: 56,
    tag: "분석",
  },
  {
    id: 5,
    category: "마감시황",
    title: "미국 증시 영향, 국내 증시 혼조세",
    summary: "전날 미국 증시가 혼조세를 보인 영향으로 국내 증시도 방향성을 찾지 못하고 등락을 반복했습니다.",
    author: "시황팀",
    time: "4시간 전",
    views: 1234,
    comments: 34,
    tag: null,
  },
  {
    id: 6,
    category: "상한가 분석",
    title: "HMM 상한가, 해운업 훈풍",
    summary: "HMM이 운임 상승 기대감에 상한가를 기록했습니다. 해운업 전반에 긍정적인 흐름이 이어지고 있습니다.",
    author: "종목분석팀",
    time: "5시간 전",
    views: 1654,
    comments: 42,
    tag: null,
  },
  {
    id: 7,
    category: "마감시황",
    title: "반도체주 강세, 코스피 상승 견인",
    summary: "삼성전자와 SK하이닉스 등 반도체주가 강세를 보이며 코스피 상승을 견인했습니다.",
    author: "시황팀",
    time: "어제",
    views: 3421,
    comments: 89,
    tag: null,
  },
  {
    id: 8,
    category: "상한가 분석",
    title: "셀트리온 상한가, 바이오 신약 기대감",
    summary: "셀트리온이 신약 임상 결과 호조 소식에 상한가를 기록했습니다. 바이오 업종 전반에 긍정적 영향이 예상됩니다.",
    author: "종목분석팀",
    time: "어제",
    views: 2987,
    comments: 67,
    tag: "분석",
  },
];

export function MarketScreen() {
  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-1">시황/리포트 📊</h2>
        <p className="text-orange-50 text-sm">전문가의 시황 분석과 종목 리포트</p>
      </div>

      {/* 카테고리 필터 */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["전체", "마감시황", "상한가 분석"].map((category) => (
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

      {/* 게시판 리스트 */}
      <div className="px-4 space-y-3">
        {reportPosts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      post.category === "마감시황"
                        ? "text-blue-600 bg-blue-50"
                        : "text-purple-600 bg-purple-50"
                    }`}
                  >
                    {post.category}
                  </span>
                  {post.tag && (
                    <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">
                      {post.tag}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base mb-2 leading-snug">
                  {post.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  {post.summary}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{post.author}</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{post.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{post.views.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      <span>{post.comments}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 더보기 버튼 */}
      <div className="px-4 mt-4">
        <button className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium hover:bg-gray-200 transition-colors">
          더 많은 리포트 보기
        </button>
      </div>

      {/* 주식 용어 박스 */}
      <div className="px-4 mt-6">
        <StockTermBox />
      </div>
    </div>
  );
}