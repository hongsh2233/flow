"use client";

import { Calendar } from "../components/module/calendar/Calendar";
import { StockTermBox } from "../components/module/stock-term-box";

export default function CalendarPage() {
  return (
    <div className="content__wrap">
      <div style={{ margin: "0 0 1rem" }}>
        <StockTermBox />
      </div>
      <Calendar />
    </div>
  );
}
