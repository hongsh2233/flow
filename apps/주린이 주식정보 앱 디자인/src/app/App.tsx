import { useState, useEffect } from "react";
import { BottomNavigation } from "./components/bottom-navigation";
import { HomeScreen } from "./components/screens/home-screen";
import { CalendarScreen } from "./components/screens/calendar-screen";
import { NewsScreen } from "./components/screens/news-screen";
import { MarketScreen } from "./components/screens/market-screen";
import { StocksScreen } from "./components/screens/stocks-screen";
import { SettingsScreen } from "./components/screens/settings-screen";
import { LoginScreen } from "./components/screens/login-screen";
import { LoadingScreen } from "./components/loading-screen";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  // 파비콘 및 메타 태그 설정
  useEffect(() => {
    // 파비콘 설정
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = "/favicon.svg";
    } else {
      const newFavicon = document.createElement("link");
      newFavicon.rel = "icon";
      newFavicon.type = "image/svg+xml";
      newFavicon.href = "/favicon.svg";
      document.head.appendChild(newFavicon);
    }

    // 애플 터치 아이콘
    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!appleTouchIcon) {
      const newAppleIcon = document.createElement("link");
      newAppleIcon.rel = "apple-touch-icon";
      newAppleIcon.href = "/icon-192.png";
      document.head.appendChild(newAppleIcon);
    }

    // 매니페스트
    const manifest = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifest) {
      const newManifest = document.createElement("link");
      newManifest.rel = "manifest";
      newManifest.href = "/manifest.json";
      document.head.appendChild(newManifest);
    }

    // 테마 컬러
    const themeColor = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
    if (themeColor) {
      themeColor.content = "#fb923c";
    } else {
      const newThemeColor = document.createElement("meta");
      newThemeColor.name = "theme-color";
      newThemeColor.content = "#fb923c";
      document.head.appendChild(newThemeColor);
    }

    // 제목 설정
    document.title = "주린이 주식 - 초보 투자자를 위한 앱";
  }, []);

  // 로딩 화면 표시
  if (isLoading) {
    return <LoadingScreen onLoadComplete={() => setIsLoading(false)} />;
  }

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case "home":
        return <HomeScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "news":
        return <NewsScreen />;
      case "market":
        return <MarketScreen />;
      case "stocks":
        return <StocksScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-pink-50 to-white">
      {/* 모바일 컨테이너 */}
      <div className="max-w-[640px] mx-auto bg-white min-h-screen shadow-xl relative">
        {/* 메인 콘텐츠 */}
        <main className="pt-4">
          {renderScreen()}
        </main>

        {/* 하단 네비게이션 */}
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}