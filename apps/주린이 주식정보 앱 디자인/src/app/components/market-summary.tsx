import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

const marketIndices: MarketIndex[] = [
  { name: "코스피", value: 2456.78, change: 12.34, changePercent: 0.51 },
  { name: "코스닥", value: 756.23, change: -3.45, changePercent: -0.45 },
  { name: "코스피200", value: 326.45, change: 1.23, changePercent: 0.38 }
];

export function MarketSummary() {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-3">시장 현황</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {marketIndices.map((index) => {
          const isPositive = index.change >= 0;
          return (
            <Card key={index.name}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-600">{index.name}</h3>
                  {isPositive ? (
                    <TrendingUp className="text-red-500 w-5 h-5" />
                  ) : (
                    <TrendingDown className="text-blue-500 w-5 h-5" />
                  )}
                </div>
                <p className="text-2xl font-bold mb-1">{index.value.toFixed(2)}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
                    {isPositive ? '+' : ''}{index.change.toFixed(2)}
                  </span>
                  <span className={`text-sm font-medium ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
                    ({isPositive ? '+' : ''}{index.changePercent}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
