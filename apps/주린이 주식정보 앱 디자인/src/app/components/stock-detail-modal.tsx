import { X, TrendingUp, TrendingDown, Info, Heart, BarChart3, DollarSign } from "lucide-react";

interface StockDetailModalProps {
  stock: {
    name: string;
    code: string;
    price: number;
    change: number;
    volume?: string;
    marketCap?: string;
  };
  onClose: () => void;
}

export function StockDetailModal({ stock, onClose }: StockDetailModalProps) {
  const isPositive = stock.change >= 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-t-3xl">
          <div className="flex justify-between items-start mb-4">
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-1">{stock.name}</h2>
              <p className="text-orange-100 text-sm">{stock.code}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* 현재 가격 */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-100 mb-1">현재가</p>
                <p className="text-3xl font-bold text-white">
                  {stock.price.toLocaleString()}원
                </p>
              </div>
              {isPositive ? (
                <TrendingUp className="w-12 h-12 text-white/80" />
              ) : (
                <TrendingDown className="w-12 h-12 text-white/80" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-lg font-bold ${isPositive ? 'text-white' : 'text-white'}`}>
                {isPositive ? '+' : ''}{stock.change}%
              </span>
              <span className="text-sm text-orange-100">전일 대비</span>
            </div>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {/* 주요 정보 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stock.volume && (
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-900 font-medium">거래량</p>
                </div>
                <p className="text-xl font-bold text-blue-900">{stock.volume}</p>
              </div>
            )}
            {stock.marketCap && (
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  <p className="text-sm text-purple-900 font-medium">시가총액</p>
                </div>
                <p className="text-xl font-bold text-purple-900">{stock.marketCap}</p>
              </div>
            )}
          </div>

          {/* 주린이 설명 */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-5 mb-6 border border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-blue-900 mb-2">주린이를 위한 설명</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li><strong>현재가:</strong> 지금 이 순간의 주식 가격이에요</li>
                  <li><strong>등락률:</strong> 어제보다 얼마나 올랐거나 떨어졌는지예요</li>
                  {stock.volume && <li><strong>거래량:</strong> 오늘 거래된 주식 수량이에요</li>}
                  {stock.marketCap && <li><strong>시가총액:</strong> 이 회사의 전체 가치예요</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* 변동성 정보 */}
          <div className="mb-6">
            <h4 className="font-bold mb-3">오늘의 변동성</h4>
            <div className="flex gap-2">
              {Math.abs(stock.change) < 3 ? (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  안정
                </span>
              ) : Math.abs(stock.change) < 5 ? (
                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                  보통
                </span>
              ) : (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                  높음
                </span>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-400 to-pink-400 text-white py-4 rounded-2xl font-bold hover:shadow-lg transition-all">
              <Heart className="w-5 h-5" />
              관심 추가
            </button>
            <button className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all">
              <BarChart3 className="w-5 h-5" />
              상세 차트
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
