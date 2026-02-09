import { TrendingUp, TrendingDown, Heart, Search as SearchIcon, DollarSign, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { StockTermBox } from "../stock-term-box";
import { useState } from "react";
import { StockDetailModal } from "../stock-detail-modal";

// 실시간 검색 상위
const realtimeSearch = [
  { rank: 1, name: "삼성전자", change: 1.7 },
  { rank: 2, name: "에코프로", change: 12.5 },
  { rank: 3, name: "SK하이닉스", change: -1.76 },
  { rank: 4, name: "LG에너지", change: 0.89 },
  { rank: 5, name: "NAVER", change: 1.52 },
  { rank: 6, name: "카카오", change: -1.72 },
  { rank: 7, name: "현대차", change: 1.02 },
  { rank: 8, name: "셀트리온", change: 2.1 },
  { rank: 9, name: "포스코", change: 0.88 },
  { rank: 10, name: "삼성바이오", change: -1.5 },
];

// 거래량 상위 - 코스피
const kospiVolume = [
  { rank: 1, name: "삼성전자", code: "005930", price: 71800, change: 1.7, volume: "12.3M" },
  { rank: 2, name: "SK하이닉스", code: "000660", price: 128500, change: -1.76, volume: "8.2M" },
  { rank: 3, name: "현대차", code: "005380", price: 198000, change: 1.02, volume: "5.4M" },
  { rank: 4, name: "기아", code: "000270", price: 89000, change: 0.56, volume: "4.7M" },
  { rank: 5, name: "POSCO홀딩스", code: "005490", price: 345000, change: 0.88, volume: "3.9M" },
  { rank: 6, name: "LG화학", code: "051910", price: 456000, change: 1.11, volume: "3.2M" },
  { rank: 7, name: "삼성SDI", code: "006400", price: 345000, change: 1.3, volume: "2.8M" },
  { rank: 8, name: "LG전자", code: "066570", price: 98000, change: 0.42, volume: "2.5M" },
  { rank: 9, name: "KB금융", code: "105560", price: 67800, change: 0.85, volume: "2.3M" },
  { rank: 10, name: "신한지주", code: "055550", price: 45200, change: -0.44, volume: "2.1M" },
];

// 거래량 상위 - 코스닥
const kosdaqVolume = [
  { rank: 1, name: "에코프로비엠", code: "247540", price: 234500, change: 12.5, volume: "6.7M" },
  { rank: 2, name: "셀트리온헬스케어", code: "091990", price: 89000, change: 2.3, volume: "4.5M" },
  { rank: 3, name: "알테오젠", code: "196170", price: 145000, change: 3.1, volume: "3.8M" },
  { rank: 4, name: "엔켐", code: "348370", price: 67000, change: -1.2, volume: "3.2M" },
  { rank: 5, name: "리노공업", code: "058470", price: 234000, change: 1.8, volume: "2.9M" },
  { rank: 6, name: "위메이드", code: "112040", price: 56000, change: -2.1, volume: "2.6M" },
  { rank: 7, name: "펄어비스", code: "263750", price: 78000, change: 0.9, volume: "2.3M" },
  { rank: 8, name: "카카오게임즈", code: "293490", price: 45000, change: 1.5, volume: "2.1M" },
  { rank: 9, name: "씨젠", code: "096530", price: 34000, change: -0.8, volume: "1.9M" },
  { rank: 10, name: "에이치엘비", code: "028300", price: 23000, change: 2.7, volume: "1.7M" },
];

// 거래대금 상위 - 코스피
const kospiValue = [
  { rank: 1, name: "삼성전자", price: 71800, change: 1.7, value: "8,834억" },
  { rank: 2, name: "SK하이닉스", price: 128500, change: -1.76, value: "6,127억" },
  { rank: 3, name: "LG에너지솔루션", price: 456000, change: 0.89, value: "4,521억" },
  { rank: 4, name: "현대차", price: 198000, change: 1.02, value: "3,892억" },
  { rank: 5, name: "POSCO홀딩스", price: 345000, change: 0.88, value: "2,945억" },
  { rank: 6, name: "LG화학", price: 456000, change: 1.11, value: "2,734억" },
  { rank: 7, name: "삼성바이오로직스", price: 789000, change: -1.5, value: "2,456억" },
  { rank: 8, name: "기아", price: 89000, change: 0.56, value: "2,123억" },
  { rank: 9, name: "셀트리온", price: 178000, change: 2.1, value: "1,987억" },
  { rank: 10, name: "NAVER", price: 234500, change: 1.52, value: "1,845억" },
];

// 거래대금 상위 - 코스닥
const kosdaqValue = [
  { rank: 1, name: "에코프로비엠", price: 234500, change: 12.5, value: "1,572억" },
  { rank: 2, name: "셀트리온헬스케어", price: 89000, change: 2.3, value: "1,234억" },
  { rank: 3, name: "알테오젠", price: 145000, change: 3.1, value: "987억" },
  { rank: 4, name: "포스코퓨처엠", price: 456000, change: 9.8, value: "876억" },
  { rank: 5, name: "엔켐", price: 67000, change: -1.2, value: "745억" },
  { rank: 6, name: "리노공업", price: 234000, change: 1.8, value: "678억" },
  { rank: 7, name: "위메이드", price: 56000, change: -2.1, value: "589억" },
  { rank: 8, name: "펄어비스", price: 78000, change: 0.9, value: "512억" },
  { rank: 9, name: "카카오게임즈", price: 45000, change: 1.5, value: "467억" },
  { rank: 10, name: "씨젠", price: 34000, change: -0.8, value: "398억" },
];

// 관심종목
const favoriteStocks = [
  { id: "1", name: "삼성전자", code: "005930", price: 71800, change: 1.7 },
  { id: "2", name: "NAVER", code: "035420", price: 234500, change: 1.52 },
  { id: "3", name: "카카오", code: "035720", price: 45600, change: -1.72 },
  { id: "4", name: "현대차", code: "005380", price: 198000, change: 1.02 },
];

export function HomeScreen() {
  const [selectedStock, setSelectedStock] = useState<any>(null);

  return (
    <div className="pb-20">
      {/* 인사말 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-2">안녕하세요, 주린이님! 👋</h2>
        <p className="text-orange-50">오늘도 현명한 투자 되세요!</p>
      </div>

      {/* 주식 용어 박스 */}
      <div className="px-4 mb-6">
        <StockTermBox />
      </div>

      {/* 관심종목 */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            나의 관심종목
          </h3>
          <span className="text-sm text-gray-500">{favoriteStocks.length}개</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {favoriteStocks.map((stock) => {
            const isPositive = stock.change >= 0;
            return (
              <button
                key={stock.id}
                onClick={() => setSelectedStock(stock)}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
              >
                <h4 className="font-bold text-sm mb-1">{stock.name}</h4>
                <p className="text-xs text-gray-500 mb-2">{stock.code}</p>
                <p className="text-base font-bold mb-1">
                  {stock.price.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3 text-red-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-blue-500" />
                  )}
                  <p
                    className={`text-xs font-medium ${
                      isPositive ? "text-red-500" : "text-blue-500"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {stock.change}%
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 환율 정보 */}
      <div className="px-4 mb-6">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          환율 정보
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">USD</p>
            <p className="text-base font-bold">1,342.50</p>
            <p className="text-xs text-red-500 font-medium">+5.20</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">JPY</p>
            <p className="text-base font-bold">912.34</p>
            <p className="text-xs text-blue-500 font-medium">-2.15</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">EUR</p>
            <p className="text-base font-bold">1,456.78</p>
            <p className="text-xs text-red-500 font-medium">+3.42</p>
          </div>
        </div>
      </div>

      {/* 지수 정보 */}
      <div className="px-4 mb-6">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          주요 지수
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-700 mb-1">코스피</p>
            <p className="text-2xl font-bold">2,456.78</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <p className="text-sm text-red-500 font-medium">+12.34 (0.51%)</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <p className="text-sm text-purple-700 mb-1">코스닥</p>
            <p className="text-2xl font-bold">756.23</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-blue-500 font-medium">-3.45 (-0.45%)</p>
            </div>
          </div>
        </div>
      </div>

      {/* 실시간 검색 상위 */}
      <div className="px-4 mb-6">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <SearchIcon className="w-5 h-5 text-orange-500" />
          실시간 검색 상위
        </h3>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {realtimeSearch.map((item) => {
              const isPositive = item.change >= 0;
              return (
                <div key={item.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-orange-500 w-4">
                      {item.rank}
                    </span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isPositive ? "text-red-500" : "text-blue-500"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {item.change}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 거래량/거래대금 상위 */}
      <div className="px-4 mb-6">
        <Tabs defaultValue="kospi-volume">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">거래 상위</h3>
          </div>
          <TabsList className="grid w-full grid-cols-4 mb-3">
            <TabsTrigger value="kospi-volume" className="text-xs">거래량(코스피)</TabsTrigger>
            <TabsTrigger value="kosdaq-volume" className="text-xs">거래량(코스닥)</TabsTrigger>
            <TabsTrigger value="kospi-value" className="text-xs">거래대금(코스피)</TabsTrigger>
            <TabsTrigger value="kosdaq-value" className="text-xs">거래대금(코스닥)</TabsTrigger>
          </TabsList>

          {/* 거래량 코스피 */}
          <TabsContent value="kospi-volume" className="mt-0">
            <div className="space-y-2">
              {kospiVolume.map((stock) => {
                const isPositive = stock.change >= 0;
                return (
                  <button
                    key={stock.rank}
                    onClick={() => setSelectedStock(stock)}
                    className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-600 w-5">
                        {stock.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">{stock.name}</h4>
                        <p className="text-xs text-gray-500">{stock.volume}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {stock.price.toLocaleString()}
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            isPositive ? "text-red-500" : "text-blue-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {stock.change}%
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* 거래량 코스닥 */}
          <TabsContent value="kosdaq-volume" className="mt-0">
            <div className="space-y-2">
              {kosdaqVolume.map((stock) => {
                const isPositive = stock.change >= 0;
                return (
                  <button
                    key={stock.rank}
                    onClick={() => setSelectedStock(stock)}
                    className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-purple-600 w-5">
                        {stock.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">{stock.name}</h4>
                        <p className="text-xs text-gray-500">{stock.volume}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {stock.price.toLocaleString()}
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            isPositive ? "text-red-500" : "text-blue-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {stock.change}%
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* 거래대금 코스피 */}
          <TabsContent value="kospi-value" className="mt-0">
            <div className="space-y-2">
              {kospiValue.map((stock) => {
                const isPositive = stock.change >= 0;
                return (
                  <button
                    key={stock.rank}
                    onClick={() => setSelectedStock(stock)}
                    className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-600 w-5">
                        {stock.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">{stock.name}</h4>
                        <p className="text-xs text-gray-500">{stock.value}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {stock.price.toLocaleString()}
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            isPositive ? "text-red-500" : "text-blue-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {stock.change}%
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* 거래대금 코스닥 */}
          <TabsContent value="kosdaq-value" className="mt-0">
            <div className="space-y-2">
              {kosdaqValue.map((stock) => {
                const isPositive = stock.change >= 0;
                return (
                  <button
                    key={stock.rank}
                    onClick={() => setSelectedStock(stock)}
                    className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-purple-600 w-5">
                        {stock.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">{stock.name}</h4>
                        <p className="text-xs text-gray-500">{stock.value}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {stock.price.toLocaleString()}
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            isPositive ? "text-red-500" : "text-blue-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {stock.change}%
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 모달 */}
      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}