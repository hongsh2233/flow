import { Lightbulb, X } from "lucide-react";
import { useState } from "react";

const tips = [
  "💡 주린이 TIP: 처음에는 소액으로 시작하세요. 투자는 여유 자금으로!",
  "💡 주린이 TIP: 하나의 종목에 몰빵하지 마세요. 분산투자가 안전해요!",
  "💡 주린이 TIP: 급등한 종목보다는 안정적인 기업을 선택하세요.",
  "💡 주린이 TIP: 손절과 익절 기준을 미리 정해두세요.",
  "💡 주린이 TIP: 시장 뉴스를 꾸준히 확인하는 습관을 만드세요."
];

export function BeginnerTip() {
  const [currentTip, setCurrentTip] = useState(0);
  const [visible, setVisible] = useState(true);

  const nextTip = () => {
    setCurrentTip((prev) => (prev + 1) % tips.length);
  };

  if (!visible) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-6 relative">
      <button 
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <Lightbulb className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <p className="text-sm text-gray-800">{tips[currentTip]}</p>
          <button 
            onClick={nextTip}
            className="text-xs text-yellow-700 hover:text-yellow-800 mt-2 underline"
          >
            다음 팁 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}
