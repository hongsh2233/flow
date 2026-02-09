import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onLoadComplete: () => void;
}

export function LoadingScreen({ onLoadComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onLoadComplete();
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    return () => clearInterval(timer);
  }, [onLoadComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-orange-400 via-pink-400 to-orange-500 flex flex-col items-center justify-center z-[100]">
      <div className="text-center">
        {/* 아이콘 애니메이션 */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative bg-white p-8 rounded-3xl shadow-2xl">
            <BarChart3 className="w-24 h-24 text-orange-500 animate-bounce" />
          </div>
        </div>

        {/* 앱 이름 */}
        <h1 className="text-4xl font-bold text-white mb-2">주린이 주식</h1>
        <p className="text-orange-100 text-lg mb-8">초보 투자자를 위한 친절한 앱</p>

        {/* 프로그레스 바 */}
        <div className="w-64 mx-auto">
          <div className="bg-white/30 rounded-full h-2 overflow-hidden backdrop-blur-sm">
            <div
              className="bg-white h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-white/80 text-sm mt-3">로딩 중... {progress}%</p>
        </div>

        {/* 메시지 */}
        <div className="mt-12 space-y-2">
          <p className="text-white/90 text-sm">💡 투자는 여유 자금으로!</p>
          <p className="text-white/90 text-sm">📚 꾸준한 학습이 성공의 지름길</p>
        </div>
      </div>
    </div>
  );
}
