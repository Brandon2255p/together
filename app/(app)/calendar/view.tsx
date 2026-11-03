"use client";

import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { useCalendarViewModel, type CalendarViewData } from "./view-model";

export function CalendarView({ data }: { data: CalendarViewData }) {
  const vm = useCalendarViewModel(data);
  return <CalendarScreen {...vm} />;
}
