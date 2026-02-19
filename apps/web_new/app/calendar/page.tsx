"use client";

import { Calendar } from "../components/module/calendar/Calendar";
import { StockTermBox } from "../components/module/stock-term-box";

export default function CalendarPage() {
  return (
    <div className="content__wrap">
      <StockTermBox wrapperStyle={{ marginTop: "1.5rem" }} />
      <Calendar />
    </div>
  );
}
