import { 
  Bell, 
  Moon, 
  HelpCircle, 
  Lock, 
  Mail, 
  ChevronRight,
  User,
  Shield,
  FileText
} from "lucide-react";
import { Switch } from "../ui/switch";
import { StockTermBox } from "../stock-term-box";

const settingsGroups = [
  {
    title: "내 정보",
    items: [
      { icon: User, label: "프로필 관리", hasArrow: true },
      { icon: Mail, label: "이메일 변경", hasArrow: true },
    ],
  },
  {
    title: "알림 설정",
    items: [
      { icon: Bell, label: "푸시 알림", hasSwitch: true, enabled: true },
      { icon: Bell, label: "가격 알림", hasSwitch: true, enabled: true },
      { icon: Bell, label: "뉴스 알림", hasSwitch: true, enabled: false },
    ],
  },
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", hasSwitch: true, enabled: false },
      { icon: Lock, label: "보안 설정", hasArrow: true },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: HelpCircle, label: "도움말", hasArrow: true },
      { icon: Shield, label: "개인정보 처리방침", hasArrow: true },
      { icon: FileText, label: "이용약관", hasArrow: true },
    ],
  },
];

export function SettingsScreen() {
  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-1">설정 ⚙️</h2>
        <p className="text-orange-50 text-sm">앱을 내 마음대로 설정하세요</p>
      </div>

      {/* 사용자 프로필 */}
      <div className="px-4 mb-6">
        <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl p-5 border border-orange-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              주
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">주린이님</h3>
              <p className="text-sm text-gray-600">초보 투자자</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* 설정 그룹 */}
      <div className="px-4 space-y-6">
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            <h3 className="font-bold text-sm text-gray-500 mb-3 px-2">
              {group.title}
            </h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div
                    key={itemIndex}
                    className={`flex items-center justify-between p-4 ${
                      itemIndex !== group.items.length - 1
                        ? "border-b border-gray-100"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                        <Icon className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.hasSwitch && (
                      <Switch defaultChecked={item.enabled} />
                    )}
                    {item.hasArrow && (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 버전 정보 */}
      <div className="px-4 mt-6">
        <div className="text-center">
          <p className="text-sm text-gray-500">주린이 주식 v1.0.0</p>
          <p className="text-xs text-gray-400 mt-1">
            © 2026 Jurini Stock. All rights reserved.
          </p>
        </div>
      </div>

      {/* 로그아웃 버튼 */}
      <div className="px-4 mt-6">
        <button className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium hover:bg-gray-200 transition-colors">
          로그아웃
        </button>
      </div>

      {/* 주식 용어 박스 */}
      <div className="px-4 mt-6">
        <StockTermBox />
      </div>
    </div>
  );
}