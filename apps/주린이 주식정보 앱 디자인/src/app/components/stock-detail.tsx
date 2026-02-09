import { X, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Stock } from "./stock-card";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface StockDetailProps {
  stock: Stock;
  onClose: () => void;
}

export function StockDetail({ stock, onClose }: StockDetailProps) {
  const isPositive = stock.change >= 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{stock.name}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">{stock.code}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* 현재 가격 */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-4xl font-bold">{stock.price.toLocaleString()}원</h3>
              {isPositive ? (
                <TrendingUp className="text-red-500 w-8 h-8" />
              ) : (
                <TrendingDown className="text-blue-500 w-8 h-8" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
                {isPositive ? '+' : ''}{stock.change.toLocaleString()}원
              </span>
              <span className={`text-lg font-semibold ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
                ({isPositive ? '+' : ''}{stock.changePercent}%)
              </span>
            </div>
          </div>

          {/* 거래 정보 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">거래량</p>
              <p className="text-lg font-semibold">{stock.volume}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">거래대금</p>
              <p className="text-lg font-semibold">
                {(parseInt(stock.volume.replace(/,/g, '')) * stock.price / 100000000).toFixed(0)}억원
              </p>
            </div>
          </div>

          {/* 주린이를 위한 설명 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">주린이를 위한 용어 설명</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><strong>현재가:</strong> 지금 이 주식의 가격이에요</li>
                  <li><strong>등락률:</strong> 어제보다 얼마나 올랐는지/떨어졌는지 %로 표시</li>
                  <li><strong>거래량:</strong> 오늘 거래된 주식 수량</li>
                  <li><strong>거래대금:</strong> 거래량 × 가격 = 오늘 거래된 총 금액</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 투자 위험도 */}
          <div className="mb-4">
            <h4 className="font-semibold mb-2">오늘의 변동성</h4>
            <div className="flex gap-2">
              {Math.abs(stock.changePercent) < 3 ? (
                <Badge variant="default" className="bg-green-500">안정</Badge>
              ) : Math.abs(stock.changePercent) < 5 ? (
                <Badge variant="default" className="bg-yellow-500">보통</Badge>
              ) : (
                <Badge variant="destructive">높음</Badge>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3 mt-6">
            <button className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors">
              매수 관심 추가
            </button>
            <button className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors">
              매도 관심 추가
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
