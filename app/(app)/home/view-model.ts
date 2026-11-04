"use client";

import type { Route } from "next";
import { dueLabel, greeting, hourNow, longDate } from "@/lib/format";
import type { CalendarEvent, Chore, DayKey, Member, Together, TogetherSummary } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { useChores } from "../_lib/use-chores";

export interface HomeViewData {
  together: Together;
  today: DayKey;
  chores: Chore[];
  toBuy: number;
  wantToGo: number;
  /** today onwards, for "Up next" */
  events: CalendarEvent[];
  /** all your Togethers, for the switcher pill */
  togethers: TogetherSummary[];
}

const LINKS = {
  chores: "/lists?tab=chores" as Route,
  shopping: "/lists" as Route,
  places: "/places?tab=want" as Route,
  calendar: "/calendar" as Route,
  together: "/together" as Route,
  togethers: "/togethers" as Route,
  profile: "/profile" as Route,
};

export function useHomeViewModel(data: HomeViewData) {
  const { together, today } = data;
  const { chores, error, toggle } = useChores(data.chores);
  const me = together.members.find((m) => m.id === together.meId);
  const people = (ids: string[]) => ids.map((id) => together.members.find((m) => m.id === id)).filter((m): m is Member => !!m);

  const next = [...data.events].sort((a, b) => (a.day + (a.time ?? "")).localeCompare(b.day + (b.time ?? "")))[0];
  const upNext = next
    ? {
        title: next.title,
        when: next.day === today ? (next.time ?? "All day") : `${dueLabel(next.day, today)}${next.time ? ` · ${next.time}` : ""}`,
        where: next.location,
        people: people(next.attendees),
      }
    : null;

  // due today or overdue; stays on screen once ticked until the next visit
  const dueToday = chores
    .filter((c) => c.due !== null && c.due <= today && (c.assignees.includes(together.meId) || c.assignees.length > 1))
    .map((c) => toChoreRow(c, together.members, today));

  return {
    greeting: `${greeting(hourNow())}, ${me?.name ?? "you"}`,
    dateLabel: longDate(today),
    members: together.members,
    switcher: {
      name: together.name,
      tone: me?.tone ?? "accent",
      hasNews: data.togethers.some((t) => !t.current && t.hasNews),
    },
    upNext,
    dueToday,
    onChoreDoneChange: (id: string, done: boolean) => void toggle(id, done),
    toBuy: data.toBuy,
    wantToGo: data.wantToGo,
    links: LINKS,
    error,
  };
}
