import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export interface Stock {
  id: string;
  name: string;
  code: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
}

interface StockCardProps {
  stock: Stock;
  onClick: () => void;
}

export function StockCard({ stock, onClick }: StockCardProps) {
  const isPositive = stock.change >= 0;

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg">{stock.name}</h3>
            <p className="text-sm text-gray-500">{stock.code}</p>
          </div>
          {isPositive ? (
            <TrendingUp className="text-red-500 w-6 h-6" />
          ) : (
            <TrendingDown className="text-blue-500 w-6 h-6" />
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{stock.price.toLocaleString()}원</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-medium ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
              {isPositive ? '+' : ''}{stock.change.toLocaleString()}원
            </span>
            <span className={`text-sm font-medium ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
              ({isPositive ? '+' : ''}{stock.changePercent}%)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">거래량: {stock.volume}</p>
        </div>
      </CardContent>
    </Card>
  );
}
