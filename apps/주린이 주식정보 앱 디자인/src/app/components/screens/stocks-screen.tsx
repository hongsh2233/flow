import { Search, TrendingUp, TrendingDown, Star, Heart, BarChart3, Building2 } from "lucide-react";
import { useState } from "react";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { StockTermBox } from "../stock-term-box";
import { StockDetailModal } from "../stock-detail-modal";

// 섹터 데이터
const kospiSectors = [
  { name: "반도체", change: 2.3, value: 1245.67 },
  { name: "자동차", change: 1.5, value: 892.34 },
  { name: "금융", change: 0.8, value: 567.89 },
  { name: "화학", change: -0.5, value: 432.12 },
  { name: "철강", change: -1.2, value: 345.67 },
];

const kosdaqSectors = [
  { name: "IT/소프트웨어", change: 3.1, value: 234.56 },
  { name: "바이오", change: 2.8, value: 456.78 },
  { name: "게임", change: 1.2, value: 189.34 },
  { name: "제약", change: -0.3, value: 278.91 },
  { name: "미디어", change: -1.5, value: 123.45 },
];

// 시가총액 상위 20
const marketCapStocks = [
  { rank: 1, name: "삼성전자", code: "005930", price: 71800, change: 1.7, marketCap: "428조" },
  { rank: 2, name: "SK하이닉스", code: "000660", price: 128500, change: -1.76, marketCap: "93조" },
  { rank: 3, name: "삼성바이오로직스", code: "207940", price: 789000, change: -1.5, marketCap: "56조" },
  { rank: 4, name: "NAVER", code: "035420", price: 234500, change: 1.52, marketCap: "38조" },
  { rank: 5, name: "LG에너지솔루션", code: "373220", price: 456000, change: 0.89, marketCap: "106조" },
  { rank: 6, name: "카카오", code: "035720", price: 45600, change: -1.72, marketCap: "20조" },
  { rank: 7, name: "현대차", code: "005380", price: 198000, change: 1.02, marketCap: "42조" },
  { rank: 8, name: "기아", code: "000270", price: 89000, change: 0.56, marketCap: "35조" },
  { rank: 9, name: "셀트리온", code: "068270", price: 178000, change: 2.1, marketCap: "24조" },
  { rank: 10, name: "삼성SDI", code: "006400", price: 345000, change: 1.3, marketCap: "23조" },
];

// 상승종목 상위 10
const risingStocks = [
  { rank: 1, name: "에코프로비엠", code: "247540", price: 234500, change: 12.5 },
  { rank: 2, name: "포스코퓨처엠", code: "003670", price: 456000, change: 9.8 },
  { rank: 3, name: "LG화학", code: "051910", price: 567000, change: 8.3 },
  { rank: 4, name: "POSCO홀딩스", code: "005490", price: 345000, change: 7.2 },
  { rank: 5, name: "삼성전자", code: "005930", price: 71800, change: 6.5 },
  { rank: 6, name: "현대차", code: "005380", price: 198000, change: 5.9 },
  { rank: 7, name: "기아", code: "000270", price: 89000, change: 5.3 },
  { rank: 8, name: "SK이노베이션", code: "096770", price: 123000, change: 4.8 },
  { rank: 9, name: "LG전자", code: "066570", price: 98000, change: 4.2 },
  { rank: 10, name: "삼성물산", code: "028260", price: 134000, change: 3.7 },
];

// 관심종목
const favoriteStocks = [
  { id: "1", name: "삼성전자", code: "005930", price: 71800, change: 1.7 },
  { id: "2", name: "NAVER", code: "035420", price: 234500, change: 1.52 },
  { id: "3", name: "KB금융", code: "105560", price: 67800, change: 0.85 },
  { id: "4", name: "삼성바이오", code: "207940", price: 789000, change: -1.5 },
];

export function StocksScreen() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("favorite");
  const [selectedStock, setSelectedStock] = useState<any>(null);

  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-1">종목 자료 📈</h2>
        <p className="text-orange-50 text-sm">시장 데이터와 종목 정보</p>
      </div>

      {/* 검색 */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="종목명 또는 코드 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 py-6 rounded-2xl border-gray-200"
          />
        </div>
      </div>

      {/* 탭 메뉴 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="favorite" className="text-xs">관심종목</TabsTrigger>
          <TabsTrigger value="market" className="text-xs">시장현황</TabsTrigger>
          <TabsTrigger value="marketcap" className="text-xs">시가총액</TabsTrigger>
          <TabsTrigger value="rising" className="text-xs">상승종목</TabsTrigger>
        </TabsList>

        {/* 관심종목 */}
        <TabsContent value="favorite" className="mt-0">
          <div className="space-y-2">
            {favoriteStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <button
                  key={stock.id}
                  onClick={() => setSelectedStock(stock)}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button>
                        <Heart className="w-5 h-5 fill-red-400 text-red-400" />
                      </button>
                      <div className="flex-1">
                        <h4 className="font-bold text-base">{stock.name}</h4>
                        <p className="text-xs text-gray-500">{stock.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-base mb-1">
                        {stock.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-red-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-blue-500" />
                        )}
                        <p
                          className={`text-sm font-medium ${
                            isPositive ? "text-red-500" : "text-blue-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {stock.change}%
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* 시장현황 */}
        <TabsContent value="market" className="mt-0">
          <div className="space-y-6">
            {/* 코스피 섹터 */}
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                코스피 섹터별
              </h3>
              <div className="space-y-2">
                {kospiSectors.map((sector, index) => {
                  const isPositive = sector.change >= 0;
                  return (
                    <div
                      key={index}
                      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{sector.name}</p>
                        <p className="text-xs text-gray-500">{sector.value}</p>
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          isPositive ? "text-red-500" : "text-blue-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {sector.change}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 코스닥 섹터 */}
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                코스닥 섹터별
              </h3>
              <div className="space-y-2">
                {kosdaqSectors.map((sector, index) => {
                  const isPositive = sector.change >= 0;
                  return (
                    <div
                      key={index}
                      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{sector.name}</p>
                        <p className="text-xs text-gray-500">{sector.value}</p>
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          isPositive ? "text-red-500" : "text-blue-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {sector.change}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 시가총액 TOP 20 */}
        <TabsContent value="marketcap" className="mt-0">
          <div className="space-y-2">
            {marketCapStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <button
                  key={stock.rank}
                  onClick={() => setSelectedStock(stock)}
                  className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-orange-600">
                        {stock.rank}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm">{stock.name}</h4>
                      <p className="text-xs text-gray-500">{stock.code}</p>
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
                    <div className="text-right">
                      <p className="text-xs text-gray-500">시총</p>
                      <p className="text-sm font-bold text-purple-600">
                        {stock.marketCap}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* 상승종목 TOP 10 */}
        <TabsContent value="rising" className="mt-0">
          <div className="space-y-2">
            {risingStocks.map((stock) => (
              <button
                key={stock.rank}
                onClick={() => setSelectedStock(stock)}
                className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-red-600">
                      {stock.rank}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm">{stock.name}</h4>
                    <p className="text-xs text-gray-500">{stock.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {stock.price.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      <TrendingUp className="w-3 h-3 text-red-500" />
                      <p className="text-sm font-bold text-red-500">
                        +{stock.change}%
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 주식 용어 박스 */}
      <div className="mt-6">
        <StockTermBox />
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