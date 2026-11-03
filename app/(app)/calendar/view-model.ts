"use client";

import { useState } from "react";
import type { AgendaRow } from "@/components/calendar/calendar-screen";
import { getEvents } from "@/lib/actions/calendar";
import { agendaFor, gridRange, monthGrid } from "@/lib/calendar/month";
import { dayDate, monthName, shortDay, toKey } from "@/lib/format";
import type { CalendarEvent, Chore, DayKey, Member, Together } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { useChores } from "../_lib/use-chores";

export interface CalendarViewData {
  together: Together;
  today: DayKey;
  /** the current month's grid */
  events: CalendarEvent[];
  chores: Chore[];
}

export function useCalendarViewModel(data: CalendarViewData) {
  const { together, today } = data;
  const t = dayDate(today);
  const [month, setMonth] = useState({ year: t.getUTCFullYear(), month: t.getUTCMonth() });
  const [selected, setSelected] = useState<DayKey>(today);
  const [events, setEvents] = useState(data.events);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { chores, error: choreError, toggle } = useChores(data.chores);

  const toneOf = (id: string) => together.members.find((m) => m.id === id)?.tone;
  const people = (ids: string[]) => ids.map((id) => together.members.find((m) => m.id === id)).filter((m): m is Member => !!m);

  async function goTo(delta: number) {
    const d = new Date(Date.UTC(month.year, month.month + delta, 1));
    const next = { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    setMonth(next);
    setSelected(next.year === t.getUTCFullYear() && next.month === t.getUTCMonth() ? today : toKey(d));
    setLoading(true);
    setLoadError(null);
    const { from, to } = gridRange(next.year, next.month);
    const result = await getEvents(from, to);
    setLoading(false);
    if (!result.data) return setLoadError(result.error ?? "Couldn't load that month.");
    setEvents(result.data);
  }

  const agenda: AgendaRow[] = agendaFor(selected, events, chores).map((entry) => {
    if (entry.kind === "chore") return { kind: "chore", id: entry.key, row: toChoreRow(entry.chore, together.members, today) };
    const e = entry.event;
    const tone = e.attendees.length > 1 ? "ink" : (toneOf(e.attendees[0] ?? "") ?? "ink");
    return { kind: "event", id: e.id, title: e.title, when: e.time ?? "All day", where: e.location, people: people(e.attendees), tone };
  });

  return {
    monthLabel: monthName(month.year, month.month),
    yearLabel: String(month.year),
    weeks: monthGrid(month.year, month.month, events, chores, toneOf),
    today,
    selected,
    onSelect: setSelected,
    onPrevMonth: () => void goTo(-1),
    onNextMonth: () => void goTo(1),
    legend: together.members,
    agendaTitle: selected === today ? `Today · ${shortDay(selected)}` : shortDay(selected),
    agenda,
    onChoreDoneChange: (id: string, done: boolean) => void toggle(id, done),
    loading,
    error: loadError ?? choreError,
  };
}
