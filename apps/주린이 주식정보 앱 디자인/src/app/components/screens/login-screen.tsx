import { BarChart3, Mail, Lock, User } from "lucide-react";
import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 실제로는 여기서 인증 처리를 해야 합니다
    onLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-pink-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-[640px] bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white p-4 rounded-3xl shadow-lg">
              <BarChart3 className="w-12 h-12 text-orange-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">주린이 주식</h1>
          <p className="text-orange-100">초보 투자자를 위한 친절한 주식 앱</p>
        </div>

        {/* 폼 */}
        <div className="p-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                !isSignUp
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                isSignUp
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="주린이"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-11 py-6 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="email"
                  placeholder="jurini@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 py-6 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 py-6 rounded-xl"
                />
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-600">로그인 상태 유지</span>
                </label>
                <button type="button" className="text-orange-500 hover:text-orange-600 font-medium">
                  비밀번호 찾기
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-6 bg-gradient-to-r from-orange-400 to-pink-400 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all"
            >
              {isSignUp ? "회원가입" : "로그인"}
            </Button>
          </form>

          {/* 소셜 로그인 */}
          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">또는</span>
              </div>
            </div>

            <div className="space-y-3">
              <button className="w-full py-3 bg-yellow-400 text-gray-800 rounded-xl font-bold hover:bg-yellow-500 transition-colors">
                카카오로 시작하기
              </button>
              <button className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors">
                네이버로 시작하기
              </button>
            </div>
          </div>

          {/* 주린이 안내 */}
          <div className="mt-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border-2 border-yellow-200">
            <h4 className="font-bold text-orange-900 mb-2">💡 주린이를 위한 TIP</h4>
            <p className="text-sm text-orange-800 leading-relaxed">
              주식 투자는 여유 자금으로! 회원가입하고 관심 종목을 저장해보세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
