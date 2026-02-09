import { Calendar as CalendarIcon, Clock, Building2, DollarSign, Users } from "lucide-react";
import { useState } from "react";
import { StockTermBox } from "../stock-term-box";

// 주간 날짜 생성
const getWeekDates = () => {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay; // 월요일부터 시작
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + diff + i);
    weekDates.push({
      date: date.getDate(),
      day: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
      fullDate: date,
      isToday: date.toDateString() === today.toDateString(),
    });
  }
  return weekDates;
};

const scheduleData = [
  {
    id: 1,
    type: "earnings",
    icon: Building2,
    company: "삼성전자",
    title: "4분기 실적 발표",
    date: "2월 10일",
    time: "09:00",
    color: "bg-blue-500",
  },
  {
    id: 2,
    type: "dividend",
    icon: DollarSign,
    company: "SK하이닉스",
    title: "배당금 지급일",
    date: "2월 10일",
    time: "전일",
    color: "bg-green-500",
  },
  {
    id: 3,
    type: "meeting",
    icon: Users,
    company: "NAVER",
    title: "정기 주주총회",
    date: "2월 12일",
    time: "14:00",
    color: "bg-purple-500",
  },
  {
    id: 4,
    type: "earnings",
    icon: Building2,
    company: "카카오",
    title: "4분기 실적 발표",
    date: "2월 13일",
    time: "10:00",
    color: "bg-blue-500",
  },
  {
    id: 5,
    type: "dividend",
    icon: DollarSign,
    company: "현대차",
    title: "배당금 지급일",
    date: "2월 14일",
    time: "전일",
    color: "bg-green-500",
  },
  {
    id: 6,
    type: "earnings",
    icon: Building2,
    company: "LG화학",
    title: "4분기 실적 발표",
    date: "2월 15일",
    time: "09:30",
    color: "bg-blue-500",
  },
];

export function CalendarScreen() {
  const weekDates = getWeekDates();
  const [selectedDate, setSelectedDate] = useState(
    weekDates.find((d) => d.isToday)?.date || weekDates[0].date
  );

  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-400 p-6 rounded-b-3xl text-white mb-4">
        <h2 className="text-2xl font-bold mb-1">일정 캘린더 📅</h2>
        <p className="text-orange-50 text-sm">중요한 주식 일정을 놓치지 마세요</p>
      </div>

      {/* 월 표시 */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">2월 2026</h3>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <CalendarIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 주간 캘린더 */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((dateInfo) => (
              <button
                key={dateInfo.date}
                onClick={() => setSelectedDate(dateInfo.date)}
                className={`flex flex-col items-center py-3 rounded-xl transition-all ${
                  selectedDate === dateInfo.date
                    ? "bg-gradient-to-br from-orange-400 to-pink-400 text-white shadow-md scale-105"
                    : dateInfo.isToday
                    ? "bg-orange-50 text-orange-600"
                    : "hover:bg-gray-50"
                }`}
              >
                <span className="text-xs font-medium mb-1">{dateInfo.day}</span>
                <span className="text-lg font-bold">{dateInfo.date}</span>
                {dateInfo.isToday && selectedDate !== dateInfo.date && (
                  <div className="w-1 h-1 bg-orange-500 rounded-full mt-1"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 일정 필터 */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["전체", "실적발표", "배당", "주주총회"].map((filter) => (
            <button
              key={filter}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === "전체"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* 일정 리스트 */}
      <div className="px-4">
        <h3 className="font-bold text-lg mb-3">이번 주 일정</h3>
        <div className="space-y-3">
          {scheduleData.map((schedule) => {
            const Icon = schedule.icon;
            return (
              <div
                key={schedule.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className={`${schedule.color} p-3 rounded-xl`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h4 className="font-bold text-base">{schedule.title}</h4>
                        <p className="text-sm text-gray-600">{schedule.company}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-600">
                          {schedule.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{schedule.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 주식 용어 박스 */}
      <div className="px-4 mt-6">
        <StockTermBox />
      </div>
    </div>
  );
}